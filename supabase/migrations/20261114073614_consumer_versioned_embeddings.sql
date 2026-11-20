begin;

-- Derived indexes may coexist. The legacy 512-dimension table and its data are preserved.
create table public.consumer_embedding_profiles (
  id text primary key,
  profile jsonb not null check (profile->>'id'=id and (profile->>'dimensions')::integer in (512,1024)),
  status text not null default 'building' check(status in ('building','ready','failed')),
  lease uuid, locked_until timestamptz, last_error text, indexed_at timestamptz
);
insert into public.consumer_embedding_profiles(id,profile) values
('bge-small-zh-v1.5-512-v1','{"id":"bge-small-zh-v1.5-512-v1","provider":"local-bge","model":"BAAI/bge-small-zh-v1.5-onnx-quantized","revision":"v1.5-onnx-quantized","dimensions":512,"preprocessing":"product-facts-v1","indexVersion":1}'),
('qwen-text-embedding-v4-1024-v1','{"id":"qwen-text-embedding-v4-1024-v1","provider":"qwen","model":"text-embedding-v4","revision":"provider-alias:text-embedding-v4","dimensions":1024,"preprocessing":"product-facts-v1","indexVersion":1}');
create table public.consumer_catalog_vectors (
  profile_id text not null references public.consumer_embedding_profiles(id),
  product_key text not null check(char_length(product_key) between 1 and 100),
  content_hash text not null check(content_hash ~ '^[0-9a-f]{64}$'),
  embedding extensions.vector not null,
  indexed_at timestamptz not null default now(),
  primary key(profile_id,product_key)
);
create index consumer_vectors_bge_v1 on public.consumer_catalog_vectors
  using hnsw ((embedding::extensions.vector(512)) extensions.vector_cosine_ops)
  where profile_id='bge-small-zh-v1.5-512-v1';
create index consumer_vectors_qwen_v1 on public.consumer_catalog_vectors
  using hnsw ((embedding::extensions.vector(1024)) extensions.vector_cosine_ops)
  where profile_id='qwen-text-embedding-v4-1024-v1';
alter table public.consumer_embedding_profiles enable row level security;
alter table public.consumer_catalog_vectors enable row level security;
revoke all on public.consumer_embedding_profiles,public.consumer_catalog_vectors from public,anon,authenticated;
grant select on public.consumer_embedding_profiles to service_role;
grant update(status,lease,locked_until,last_error,indexed_at) on public.consumer_embedding_profiles to service_role;
grant select,insert,update on public.consumer_catalog_vectors to service_role;

create function private.validate_consumer_vector() returns trigger
language plpgsql security invoker set search_path='' as $$
declare expected integer;
begin
  select (profile->>'dimensions')::integer into expected from public.consumer_embedding_profiles where id=new.profile_id;
  if expected is null or extensions.vector_dims(new.embedding)<>expected or extensions.vector_norm(new.embedding)=0 then
    raise exception 'EMBEDDING_DIMENSION_MISMATCH' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_consumer_vector() from public,anon,authenticated;
create trigger consumer_vector_shape before insert or update on public.consumer_catalog_vectors
for each row execute function private.validate_consumer_vector();

create function public.claim_consumer_embedding_profile(p_profile jsonb,p_token uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare r public.consumer_embedding_profiles%rowtype;
begin
  select * into r from public.consumer_embedding_profiles where id=p_profile->>'id' for update;
  if not found or r.profile<>p_profile or p_token is null then raise exception 'INDEX_PROFILE_MISMATCH' using errcode='22023'; end if;
  if r.locked_until>now() then return false; end if;
  update public.consumer_embedding_profiles set status='building',lease=p_token,locked_until=now()+interval '2 minutes',last_error=null where id=r.id;
  return true;
end;
$$;

create function public.write_consumer_catalog_vectors(p_profile jsonb,p_token uuid,p_rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.consumer_embedding_profiles%rowtype;
begin
  select * into r from public.consumer_embedding_profiles where id=p_profile->>'id' for update;
  if not found or r.profile<>p_profile or p_token is null or r.lease is null or r.lease is distinct from p_token or r.locked_until is null or r.locked_until<=now() then
    raise exception 'INDEX_LEASE_LOST' using errcode='40001';
  end if;
  if jsonb_array_length(p_rows)>24 then raise exception 'INDEX_BATCH_INVALID'; end if;
  insert into public.consumer_catalog_vectors(profile_id,product_key,content_hash,embedding)
    select r.id,value->>'key',value->>'hash',(value->>'embedding')::extensions.vector from jsonb_array_elements(p_rows)
    on conflict(profile_id,product_key) do update set content_hash=excluded.content_hash,embedding=excluded.embedding,indexed_at=now();
  update public.consumer_embedding_profiles set locked_until=now()+interval '2 minutes' where id=r.id;
end;
$$;

create function public.finish_consumer_embedding_profile(p_profile_id text,p_token uuid,p_documents jsonb,p_error text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare r public.consumer_embedding_profiles%rowtype;
begin
  select * into r from public.consumer_embedding_profiles where id=p_profile_id for update;
  if not found or p_token is null or r.lease is null or r.lease is distinct from p_token or r.locked_until is null or r.locked_until<=now() then return false; end if;
  if p_error is null and exists(select 1 from jsonb_array_elements(p_documents) d where not exists(
    select 1 from public.consumer_catalog_vectors v where v.profile_id=r.id and v.product_key=d->>'key' and v.content_hash=d->>'hash')) then
    raise exception 'INDEX_INCOMPLETE';
  end if;
  update public.consumer_embedding_profiles set status=case when p_error is null then 'ready' else 'failed' end,
    lease=null,locked_until=null,last_error=left(p_error,200),indexed_at=case when p_error is null then now() else indexed_at end where id=r.id;
  return true;
end;
$$;

create function public.match_consumer_catalog_vectors(p_profile jsonb,p_query extensions.vector,p_documents jsonb,p_limit integer default 1000)
returns table(product_key text,similarity double precision) language plpgsql stable security invoker set search_path='' as $$
declare r public.consumer_embedding_profiles%rowtype;
begin
  select * into r from public.consumer_embedding_profiles where id=p_profile->>'id';
  if not found or r.profile<>p_profile or r.status<>'ready' then raise exception 'INDEX_PROFILE_MISMATCH'; end if;
  if extensions.vector_dims(p_query)<>(r.profile->>'dimensions')::integer or extensions.vector_norm(p_query)=0 then
    raise exception 'EMBEDDING_DIMENSION_MISMATCH';
  end if;
  return query select v.product_key,1-(v.embedding operator(extensions.<=>) p_query)
    from public.consumer_catalog_vectors v join jsonb_array_elements(p_documents) d
      on v.product_key=d->>'key' and v.content_hash=d->>'hash'
    where v.profile_id=r.id
    order by v.embedding operator(extensions.<=>) p_query,v.product_key limit least(greatest(p_limit,1),1000);
end;
$$;
revoke all on function public.claim_consumer_embedding_profile(jsonb,uuid),public.write_consumer_catalog_vectors(jsonb,uuid,jsonb),
  public.finish_consumer_embedding_profile(text,uuid,jsonb,text),public.match_consumer_catalog_vectors(jsonb,extensions.vector,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_consumer_embedding_profile(jsonb,uuid),public.write_consumer_catalog_vectors(jsonb,uuid,jsonb),
  public.finish_consumer_embedding_profile(text,uuid,jsonb,text),public.match_consumer_catalog_vectors(jsonb,extensions.vector,jsonb,integer) to service_role;
commit;
