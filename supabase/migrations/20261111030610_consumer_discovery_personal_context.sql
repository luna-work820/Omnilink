begin;

alter table public."consumer_AI assistant_messages" add column response_blocks jsonb not null default '[]'
  check(jsonb_typeof(response_blocks)='array' and octet_length(response_blocks::text)<=32768);

-- Public projection deliberately owns its read boundary; base catalog tables stay private.
create or replace view public.discovery_products with (security_barrier = true) as
select i.id, i.title, i.description, i.created_at, s.name as publisher_name, s.slug as publisher_slug,
  coalesce(m.storage_path,i.cover_image) as cover_image,
  (case when i.details->>'price_mode'='free' then 0 else v.price end)::numeric(14,2) as price, v.currency_code,
  case when i.details->>'price_mode' = 'inquiry' then 'inquiry'
       when i.details->>'price_mode' = 'free' or v.price = 0 then 'free'
       when v.price is null then 'unknown' else 'amount' end as price_mode,
  i.details->'outbound_links'->>'xiaohongshu' as xiaohongshu_url,
  i.details->'outbound_links'->>'douyin' as douyin_url,
  i.item_type, nullif(i.details->>'delivery_type','') as delivery_type,
  nullif(i.details->>'capability_kind','') as capability_kind,
  coalesce(nullif(c.name,''),nullif(i.details->'attributes'->>'category',''),nullif(i.details->'attributes'->>'category_name','')) as category
from public.catalog_item_channels cic
join public.sales_channels sc on sc.id=cic.channel_id and sc.organization_id=cic.organization_id
join public.catalog_items i on i.id=cic.catalog_item_id and i.organization_id=cic.organization_id
join public.stores s on s.id=cic.store_id and s.organization_id=cic.organization_id
left join public.catalog_categories c on c.id=i.category_id and c.organization_id=i.organization_id
left join lateral (select cv.price,cv.currency_code from public.catalog_variants cv
  where cv.catalog_item_id=i.id and cv.organization_id=i.organization_id order by cv.created_at,cv.id limit 1) v on true
left join lateral (select cm.storage_path from public.catalog_media cm
  where cm.catalog_item_id=i.id and cm.organization_id=i.organization_id and cm.media_type='image'
  order by (cm.media_role='cover') desc,cm.created_at,cm.id limit 1) m on true
where cic.is_visible and cic.store_id is not null and sc.code='storefront' and sc.channel_type='storefront'
  and sc.status='active' and i.status='active' and s.status='active' and s.deleted_at is null
  and (i.details->'outbound_links'->>'xiaohongshu' ~* '^https://([a-z0-9-]+\.)*(xiaohongshu\.com|xhslink\.com)(:[0-9]+)?([/?#]|$)'
    or i.details->'outbound_links'->>'douyin' ~* '^https://([a-z0-9-]+\.)*(douyin\.com|iesdouyin\.com)(:[0-9]+)?([/?#]|$)');
revoke all on public.discovery_products from public,anon,authenticated;
grant select on public.discovery_products to anon,authenticated,service_role;

create table public.consumer_context_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 0 check(version >= 0),
  updated_at timestamptz not null default now()
);
alter table public.consumer_context_versions enable row level security;
revoke all on public.consumer_context_versions from public,anon,authenticated;
grant select on public.consumer_context_versions to authenticated;
grant select,insert,update,delete on public.consumer_context_versions to service_role;
create policy consumer_context_version_owner on public.consumer_context_versions for select to authenticated
  using(user_id=(select auth.uid()));
insert into public.consumer_context_versions(user_id,version)
select distinct user_id,1 from public."consumer_AI assistant_memories" where status='active' and confirmed_at is not null;

create function private.bump_consumer_context_version() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='DELETE' then
    if old.status='active' then
      update public.consumer_context_versions set version=version+1,updated_at=now() where user_id=old.user_id;
    end if;
    return old;
  end if;
  if new.status='active' or (TG_OP='UPDATE' and old.status='active') then
    insert into public.consumer_context_versions(user_id,version) values(new.user_id,1)
      on conflict(user_id) do update set version=consumer_context_versions.version+1,updated_at=now();
  end if;
  return new;
end;
$$;
revoke all on function private.bump_consumer_context_version() from public,anon,authenticated;
create trigger consumer_memory_context_version after insert or update or delete on public."consumer_AI assistant_memories"
for each row execute function private.bump_consumer_context_version();

create function public.get_consumer_context_snapshot(p_user_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('version',coalesce((select version from public.consumer_context_versions where user_id=p_user_id),0),
    'memories',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'domain',domain,'text',text,'origin',origin,'status',status,'confirmedAt',confirmed_at,
      'evidence',evidence,'sourceMessageId',source_message_id,'supportIds',support_ids,'supersedeIds',supersede_ids,
      'revision',revision,'sourceKind',source_kind,
      'sourcePayload',jsonb_build_object('preferenceSignals',source_payload->'preferenceSignals')) order by updated_at desc,id)
    from public."consumer_AI assistant_memories" where user_id=p_user_id and status='active'
      and confirmed_by=p_user_id and confirmed_at is not null),'[]'::jsonb));
$$;
revoke all on function public.get_consumer_context_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_consumer_context_snapshot(uuid) to service_role;

create table public.consumer_discovery_runs (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  guest_hash text,
  session_id uuid not null,
  spec jsonb not null check(jsonb_typeof(spec)='object'),
  candidate_ids uuid[] not null check(cardinality(candidate_ids)<=1000),
  context_version bigint not null check(context_version>=0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check((user_id is not null and guest_hash is null) or (user_id is null and guest_hash is not null and guest_hash ~ '^[0-9a-f]{64}$'))
);
create index consumer_discovery_runs_expiry_idx on public.consumer_discovery_runs(expires_at);
alter table public.consumer_discovery_runs enable row level security;
revoke all on public.consumer_discovery_runs from public,anon,authenticated;
grant select,insert,update,delete on public.consumer_discovery_runs to service_role;

create function private.eligible_discovery_products(p_spec jsonb)
returns setof public.discovery_products language sql stable security invoker set search_path='' as $$
  select distinct on(p.id) p.*
  from public.discovery_products p
  where case coalesce(p_spec->>'type','商品')
    when '服务' then p.item_type='service'
    when '数字' then p.item_type='skill' or p.delivery_type in ('digital','ai_capability') or p.capability_kind is not null
    else p.item_type='product' and coalesce(p.delivery_type,'physical')='physical' end
  and not exists(select 1 from jsonb_array_elements(p_spec->'termGroups') g
    where not exists(select 1 from jsonb_array_elements_text(g) term where position(lower(term) in lower(concat_ws(' ',p.title,p.category,p.description)))>0))
  and not exists(select 1 from jsonb_array_elements_text(p_spec->'excludedTerms') term where position(lower(term) in lower(concat_ws(' ',p.title,p.category,p.description)))>0)
  and (((p_spec->>'minPrice') is null and (p_spec->>'maxPrice') is null)
    or ((p.price_mode='free' or (p.price_mode='amount' and p.price is not null and p.currency_code=p_spec->>'currency'))
      and (p_spec->>'minPrice' is null or coalesce(p.price,0)>=(p_spec->>'minPrice')::numeric)
      and (p_spec->>'maxPrice' is null or coalesce(p.price,0)<=(p_spec->>'maxPrice')::numeric)))
  order by p.id,p.publisher_slug;
$$;
revoke all on function private.eligible_discovery_products(jsonb) from public,anon,authenticated;
grant execute on function private.eligible_discovery_products(jsonb) to service_role;

create function public.search_consumer_discovery_candidates(p_spec jsonb,p_positive_terms text[],p_avoid_terms text[])
returns table(id uuid) language sql stable security invoker set search_path='' as $$
with eligible as (
  select p.*,lower(concat_ws(' ',p.title,p.category,p.description)) as search_text from private.eligible_discovery_products(p_spec) p
), scored as (
  select p.*,
    (select count(*)*4 from jsonb_array_elements(p_spec->'termGroups') g where exists
      (select 1 from jsonb_array_elements_text(g) term where position(lower(term) in lower(p.title))>0))
    + (select count(*)*2 from jsonb_array_elements_text(p_spec->'sessionTerms') term where position(lower(term) in p.search_text)>0)
    + (select count(*)*0.1 from unnest(p_positive_terms) term where position(lower(term) in p.search_text)>0)
    - (select count(*)*0.1 from unnest(p_avoid_terms) term where position(lower(term) in p.search_text)>0) as score
  from eligible p
), sequenced as (
  select p.*,row_number() over(partition by publisher_slug order by score desc,created_at desc,id) as publisher_position from scored p
)
select p.id from sequenced p order by score desc,(publisher_position-1)/4,created_at desc,p.id limit 1000;
$$;
revoke all on function public.search_consumer_discovery_candidates(jsonb,text[],text[]) from public,anon,authenticated;
grant execute on function public.search_consumer_discovery_candidates(jsonb,text[],text[]) to service_role;

create function public.create_consumer_discovery_run(p_record jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare run_id uuid := (p_record->>'id')::uuid;
begin
  delete from public.consumer_discovery_runs where id in (
    select id from public.consumer_discovery_runs where expires_at<now() order by expires_at limit 100 for update skip locked);
  insert into public.consumer_discovery_runs(id,user_id,guest_hash,session_id,spec,candidate_ids,context_version,expires_at)
  values(run_id,(p_record->>'user_id')::uuid,p_record->>'guest_hash',(p_record->>'session_id')::uuid,p_record->'spec',
    array(select jsonb_array_elements_text(p_record->'candidate_ids')::uuid),(p_record->>'context_version')::bigint,
    least((p_record->>'expires_at')::timestamptz,now()+interval '15 minutes'));
  return run_id;
end;
$$;
revoke all on function public.create_consumer_discovery_run(jsonb) from public,anon,authenticated;
grant execute on function public.create_consumer_discovery_run(jsonb) to service_role;

create function public.page_consumer_discovery_run(p_run_id uuid,p_user_id uuid,p_guest_hash text,p_session_id uuid,p_offset integer,p_version bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.consumer_discovery_runs%rowtype; page_rows jsonb; next_offset integer; row_count integer;
begin
  select * into r from public.consumer_discovery_runs where id=p_run_id and session_id=p_session_id
    and ((p_user_id is not null and user_id=p_user_id) or (p_user_id is null and user_id is null and guest_hash=p_guest_hash));
  if not found then raise exception 'SEARCH_NOT_FOUND' using errcode='P0002'; end if;
  if r.expires_at<=statement_timestamp() then raise exception 'SEARCH_EXPIRED' using errcode='P0001'; end if;
  if p_offset<0 or p_offset>cardinality(r.candidate_ids) then raise exception 'CURSOR_INVALID' using errcode='22023'; end if;
  if p_version<>r.context_version or r.context_version<>coalesce((select version from public.consumer_context_versions where user_id=p_user_id),0) then
    raise exception 'CONTEXT_CHANGED' using errcode='40001';
  end if;
  select coalesce(jsonb_agg(to_jsonb(page)-'position' order by position),'[]'::jsonb),coalesce(max(position),cardinality(r.candidate_ids)),count(*)
    into page_rows,next_offset,row_count
  from (
    select t.position,p.* from unnest(r.candidate_ids) with ordinality t(id,position)
    join private.eligible_discovery_products(r.spec) p on p.id=t.id
    where t.position>p_offset order by t.position limit 20
  ) page;
  if row_count<20 or next_offset>=cardinality(r.candidate_ids) then next_offset:=null; end if;
  return jsonb_build_object('id',r.id,'sessionId',r.session_id,'spec',r.spec,'contextVersion',r.context_version,
    'expiresAt',r.expires_at,'candidateCount',cardinality(r.candidate_ids),'rows',page_rows,'nextOffset',next_offset);
end;
$$;
revoke all on function public.page_consumer_discovery_run(uuid,uuid,text,uuid,integer,bigint) from public,anon,authenticated;
grant execute on function public.page_consumer_discovery_run(uuid,uuid,text,uuid,integer,bigint) to service_role;

-- Retests retain their own evidence even when the visible summaries are identical.
drop index public.consumer_memory_live_text_idx;
create unique index consumer_memory_live_text_idx on public."consumer_AI assistant_memories"
  (user_id,domain,lower(regexp_replace(btrim(text),'\s+',' ','g')),coalesce(source_payload->>'assessmentId',''))
  where status in ('proposed','active');
create unique index consumer_memory_assessment_id_idx on public."consumer_AI assistant_memories"
  (user_id,(source_payload->>'assessmentId')) where status in ('proposed','active') and source_payload ? 'assessmentId';

create or replace function private.manage_consumer_memory(p_user_id uuid, p_action text, p_input jsonb)
returns jsonb language plpgsql security invoker
set search_path = ''
as $$
declare
  item public."consumer_AI assistant_memories"%rowtype;
  memory_id uuid;
  memory_text text := btrim(p_input->>'text');
  support uuid[] := array(select jsonb_array_elements_text(coalesce(p_input->'supportIds','[]'))::uuid);
  supersede uuid[] := array(select jsonb_array_elements_text(coalesce(p_input->'supersedeIds','[]'))::uuid);
  affected uuid[] := '{}';
begin
  if current_user <> 'service_role' or p_user_id is null then
    raise exception 'Memory manager requires a verified server caller' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if p_action in ('manual','propose') then
    if memory_text is null or char_length(memory_text) not between 1 and 240
       or coalesce(p_input->>'domain','') not in ('clothing','skin','hair','space','other') then
      raise exception 'Invalid memory' using errcode = '22023';
    end if;
    if (select count(*) from public."consumer_AI assistant_memories" m
        where m.user_id = p_user_id and m.status = 'active' and m.confirmed_at is not null and m.id = any(support)) <> cardinality(support)
       or (select count(*) from public."consumer_AI assistant_memories" m
        where m.user_id = p_user_id and m.status = 'active' and m.id = any(supersede)) <> cardinality(supersede)
       or support && supersede then
      raise exception 'Invalid support or replacement' using errcode = '22023';
    end if;
    select * into item from public."consumer_AI assistant_memories" m
      where m.user_id = p_user_id and m.domain = p_input->>'domain' and m.status in ('proposed','active')
        and case when nullif(p_input->'sourcePayload'->>'assessmentId','') is not null
          then m.source_payload->>'assessmentId'=p_input->'sourcePayload'->>'assessmentId'
          else coalesce(m.source_payload->>'assessmentId','')=''
            and lower(regexp_replace(btrim(m.text),'\s+',' ','g'))=lower(regexp_replace(memory_text,'\s+',' ','g')) end;
    if found then
      if p_action = 'propose' or item.status = 'active' then return to_jsonb(item); end if;
      memory_id := item.id;
      p_action := 'confirm';
    else
      if (select count(*) from public."consumer_AI assistant_memories" where user_id = p_user_id and status <> 'rejected') >= 50 then
        raise exception 'Memory limit reached' using errcode = '54000';
      end if;
      if p_action = 'propose' and (coalesce(p_input->>'origin','') not in ('user','inferred')
        or coalesce(p_input->>'sourceKind','') not in ('chat','assessment','legacy')) then
        raise exception 'Invalid provenance' using errcode = '22023';
      end if;
      insert into public."consumer_AI assistant_memories"
        (user_id,domain,text,original_text,origin,status,source_kind,source_payload,evidence,source_message_id,
         support_ids,supersede_ids,confirmed_at,confirmed_by)
      values (p_user_id,p_input->>'domain',memory_text,memory_text,
        case when p_action = 'manual' then 'user' else p_input->>'origin' end,
        case when p_action = 'manual' then 'active' else 'proposed' end,
        case when p_action = 'manual' then 'manual' else p_input->>'sourceKind' end,
        coalesce(p_input->'sourcePayload','{}'),p_input->>'evidence',p_input->>'sourceMessageId',support,supersede,
        case when p_action = 'manual' then now() else null end,
        case when p_action = 'manual' then p_user_id else null end)
      returning * into item;
      return to_jsonb(item);
    end if;
  end if;

  memory_id := coalesce(memory_id, (p_input->>'id')::uuid);
  select * into item from public."consumer_AI assistant_memories"
    where id = memory_id and user_id = p_user_id for update;
  if not found then raise exception 'Memory not found' using errcode = 'P0002'; end if;
  if p_input ? 'revision' and item.revision <> (p_input->>'revision')::integer then
    raise exception 'Memory changed; reload before confirming' using errcode = '40001';
  end if;
  if p_action in ('confirm','correct') then
    if item.status = 'rejected' then raise exception 'Memory was rejected' using errcode = '22023'; end if;
    if p_action = 'confirm' and item.status = 'active' then return to_jsonb(item); end if;
    if p_action = 'correct' and (memory_text is null or char_length(memory_text) not between 1 and 240) then
      raise exception 'Invalid correction' using errcode = '22023';
    end if;
    if (select count(*) from public."consumer_AI assistant_memories" m
      where m.user_id = p_user_id and m.status = 'active' and m.id = any(item.support_ids)) <> cardinality(item.support_ids) then
      raise exception 'Support changed; review the proposal again' using errcode = '40001';
    end if;
    affected := item.supersede_ids;
    if item.source_kind='assessment' and item.source_payload ? 'answers' then
      if exists(select 1 from public."consumer_AI assistant_memories" m
        where m.user_id=p_user_id and m.id<>item.id and m.status='active' and m.source_kind='assessment'
          and m.source_payload ? 'answers' and m.created_at>item.created_at) then
        raise exception 'A newer assessment is already confirmed' using errcode='40001';
      end if;
      affected := affected || array(select m.id from public."consumer_AI assistant_memories" m
        where m.user_id=p_user_id and m.id<>item.id and m.status='active'
          and m.source_kind='assessment' and m.source_payload ? 'answers');
    end if;
    if p_action = 'correct' then affected := affected || item.id; end if;
  elsif p_action in ('reject','forget') then
    affected := array[item.id];
  else
    raise exception 'Unknown memory action' using errcode = '22023';
  end if;

  -- Invalidate every dependent inference in the same transaction as its source.
  with recursive invalidated(id) as (
    select unnest(affected)
    union
    select m.id from public."consumer_AI assistant_memories" m join invalidated i on i.id = any(m.support_ids)
      where m.user_id = p_user_id and m.status <> 'rejected'
  )
  update public."consumer_AI assistant_memories" m set status = 'rejected', updated_at = now(), revision = revision + 1
    where m.user_id = p_user_id and m.id in (select id from invalidated) and m.id <> item.id;

  if p_action = 'forget' then
    delete from public."consumer_AI assistant_memories" where id = item.id and user_id = p_user_id;
    return jsonb_build_object('id',item.id,'status','forgotten');
  end if;
  update public."consumer_AI assistant_memories" set
    text = case when p_action = 'correct' then memory_text else text end,
    source_payload = case when p_action='correct' then (source_payload-'preferenceSignals')
      || jsonb_build_object('originalPreferenceSignals',source_payload->'preferenceSignals') else source_payload end,
    status = case when p_action = 'reject' then 'rejected' else 'active' end,
    confirmed_at = case when p_action = 'reject' then confirmed_at else now() end,
    confirmed_by = case when p_action = 'reject' then confirmed_by else p_user_id end,
    updated_at = now(), revision = revision + 1
    where id = item.id and user_id = p_user_id returning * into item;
  return to_jsonb(item);
end;
$$;

commit;
