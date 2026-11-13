begin;
grant select,insert on public."consumer_AI assistant_messages" to service_role;

create table public.consumer_requests (
  id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,guest_hash text,
  owner_key text generated always as (coalesce(user_id::text,'guest:'||guest_hash)) stored,
  session_id uuid not null,request_id text not null check(char_length(request_id) between 1 and 100),
  input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),token uuid not null default gen_random_uuid(),
  status text not null default 'running' check(status in ('running','completed','failed','cancelled')),
  result jsonb check(octet_length(result::text)<=131072),http_status integer not null default 200,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 day',
  unique(owner_key,session_id,request_id),
  check((user_id is not null and guest_hash is null) or (user_id is null and guest_hash ~ '^[0-9a-f]{64}$' and guest_hash is not null))
);
create index consumer_requests_expiry_idx on public.consumer_requests(expires_at);
alter table public.consumer_requests enable row level security;
revoke all on public.consumer_requests from public,anon,authenticated;
grant select,insert,update,delete on public.consumer_requests to service_role;

create table public.consumer_execution_tasks (
  id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,guest_hash text,
  owner_key text generated always as (coalesce(user_id::text,'guest:'||guest_hash)) stored,
  session_id uuid not null,request_id text not null,input jsonb not null,
  status text not null default 'pending' check(status in ('pending','running','paused','completed','failed','cancelled')),
  checkpoints jsonb not null default '{}' check(octet_length(checkpoints::text)<=131072),
  revision integer not null default 1,attempt integer not null default 0 check(attempt between 0 and 3),
  lease uuid,lease_until timestamptz,error_code text,result jsonb check(octet_length(result::text)<=131072),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 day',unique(owner_key,session_id,request_id),
  check((user_id is not null and guest_hash is null) or (user_id is null and guest_hash ~ '^[0-9a-f]{64}$' and guest_hash is not null))
);
create index consumer_execution_tasks_owner_idx on public.consumer_execution_tasks(owner_key,session_id,updated_at desc);
create index consumer_execution_tasks_expiry_idx on public.consumer_execution_tasks(expires_at);
alter table public.consumer_execution_tasks enable row level security;
revoke all on public.consumer_execution_tasks from public,anon,authenticated;
grant select,insert,update,delete on public.consumer_execution_tasks to service_role;

create table public.consumer_external_sources (
  id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,guest_hash text,
  owner_key text generated always as (coalesce(user_id::text,'guest:'||guest_hash)) stored,
  session_id uuid not null,url text not null check(char_length(url)<=2048),url_hash text not null,
  title text not null check(char_length(title)<=240),excerpt text not null check(char_length(excerpt)<=6000),
  content_hash text not null,version integer not null default 1,fetched_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '30 days',unique(owner_key,session_id,url_hash),
  check((user_id is not null and guest_hash is null) or (user_id is null and guest_hash ~ '^[0-9a-f]{64}$' and guest_hash is not null))
);
create index consumer_external_sources_owner_idx on public.consumer_external_sources(owner_key,session_id,fetched_at desc);
create index consumer_external_sources_expiry_idx on public.consumer_external_sources(expires_at);
alter table public.consumer_external_sources enable row level security;
revoke all on public.consumer_external_sources from public,anon,authenticated;
grant select,insert,update,delete on public.consumer_external_sources to service_role;

create function private.consumer_owner_key(p_actor jsonb) returns text language plpgsql immutable security invoker set search_path='' as $$
begin
  if nullif(p_actor->>'userId','') is not null then return (p_actor->>'userId')::uuid::text; end if;
  if coalesce(p_actor->>'guestHash','') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_ACTOR' using errcode='22023'; end if;
  return 'guest:'||(p_actor->>'guestHash');
end $$;
revoke all on function private.consumer_owner_key(jsonb) from public,anon,authenticated;
grant execute on function private.consumer_owner_key(jsonb) to service_role;

create function public.manage_consumer_request(p_action text,p_actor jsonb,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.consumer_requests%rowtype; owner text:=private.consumer_owner_key(p_actor); created boolean:=false;
begin
  if p_action='begin' then
    perform private.prune_consumer_runtime();
    insert into public.consumer_requests(user_id,guest_hash,session_id,request_id,input_hash)
    values((p_actor->>'userId')::uuid,p_actor->>'guestHash',(p_actor->>'sessionId')::uuid,p_input->>'requestId',p_input->>'inputHash')
    on conflict(owner_key,session_id,request_id) do nothing returning * into r;
    created:=found;
  end if;
  if not created then
    select * into r from public.consumer_requests where owner_key=owner and session_id=(p_actor->>'sessionId')::uuid
      and request_id=p_input->>'requestId' for update;
    if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  end if;
  if r.expires_at<=now() then raise exception 'REQUEST_EXPIRED' using errcode='22023'; end if;
  if p_action='begin' then
    if r.input_hash<>p_input->>'inputHash' then raise exception 'REQUEST_CONFLICT' using errcode='22000'; end if;
    return to_jsonb(r)||jsonb_build_object('created',created);
  end if;
  if p_action='get' then return to_jsonb(r); end if;
  if p_action<>'finish' or r.token<>(p_input->>'token')::uuid or r.status<>'running' then
    raise exception 'REQUEST_CHANGED' using errcode='40001';
  end if;
  if coalesce(p_input->>'status','') not in ('completed','failed','cancelled') then raise exception 'INVALID_STATUS' using errcode='22023'; end if;
  update public.consumer_requests set status=p_input->>'status',result=p_input->'result',
    http_status=(p_input->>'httpStatus')::integer,updated_at=now() where id=r.id returning * into r;
  if coalesce((p_input->>'writeHistory')::boolean,true) and r.user_id is not null and r.status='completed' and nullif(r.result->>'text','') is not null then
    insert into public."consumer_AI assistant_messages"(id,user_id,conversation_id,role,content,style_tag,matched_product_ids,model,response_blocks)
    values('reply_'||r.request_id,r.user_id,r.session_id,'assistant',left(r.result->>'text',5000),r.result->>'styleTag',
      array(select jsonb_array_elements_text(coalesce(r.result->'matchedProductIds','[]'))),r.result->>'model',
      coalesce(r.result->'historyBlocks',r.result->'blocks','[]')) on conflict(user_id,id) do nothing;
  end if;
  return to_jsonb(r);
end $$;
revoke all on function public.manage_consumer_request(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.manage_consumer_request(text,jsonb,jsonb) to service_role;

create function public.manage_consumer_execution(p_action text,p_actor jsonb,p_input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.consumer_execution_tasks%rowtype; owner text:=private.consumer_owner_key(p_actor);
begin
  if p_action='create' then
    perform private.prune_consumer_runtime();
    insert into public.consumer_execution_tasks(user_id,guest_hash,session_id,request_id,input)
    values((p_actor->>'userId')::uuid,p_actor->>'guestHash',(p_actor->>'sessionId')::uuid,p_input->>'requestId',p_input->'input')
    on conflict(owner_key,session_id,request_id) do nothing;
    select * into t from public.consumer_execution_tasks where owner_key=owner and session_id=(p_actor->>'sessionId')::uuid
      and request_id=p_input->>'requestId' for update;
    if t.input<>p_input->'input' then raise exception 'REQUEST_CONFLICT' using errcode='22000'; end if;
    if t.user_id is not null then
      insert into public."consumer_AI assistant_messages"(id,user_id,conversation_id,role,content)
      values(t.request_id,t.user_id,t.session_id,'user',left(coalesce(nullif(array_to_string(array(select jsonb_array_elements_text(coalesce(t.input->'urls','[]'))),E'\n'),''),'对比所选商品'),5000))
      on conflict(user_id,id) do nothing;
      insert into public."consumer_AI assistant_messages"(id,user_id,conversation_id,role,content,style_tag,response_blocks)
      values('reply_'||t.request_id,t.user_id,t.session_id,'assistant','已创建对比任务。','资料对比',jsonb_build_array(jsonb_build_object(
        'type','task_progress','id',t.id,'version',1,'data',jsonb_build_object('id',t.id,'sessionId',t.session_id,'status',t.status,'revision',t.revision,
          'attempt',t.attempt,'completedSteps','[]'::jsonb,'error',null,'result',null,'updatedAt',t.updated_at))))
      on conflict(user_id,id) do nothing;
    end if;
    return to_jsonb(t);
  end if;
  select * into t from public.consumer_execution_tasks where id=(p_input->>'id')::uuid
    and owner_key=owner and session_id=(p_actor->>'sessionId')::uuid for update;
  if not found then raise exception 'TASK_NOT_FOUND' using errcode='P0002'; end if;
  if t.expires_at<=now() then raise exception 'TASK_EXPIRED' using errcode='22023'; end if;
  if p_action='get' then return to_jsonb(t); end if;
  if p_action='cancel' then
    if t.status='completed' then return to_jsonb(t); end if;
    update public.consumer_execution_tasks set status='cancelled',lease=null,lease_until=null,revision=revision+1,updated_at=now() where id=t.id returning * into t;
    return to_jsonb(t);
  end if;
  if p_action='retry' and t.status='failed' and t.attempt<3 then
    update public.consumer_execution_tasks set status='paused',checkpoints=case when error_code='CONTEXT_CHANGED' then checkpoints-'context'-'comparison' else checkpoints end,
      error_code=null,attempt=attempt+1,revision=revision+1,updated_at=now() where id=t.id returning * into t;
    return to_jsonb(t);
  end if;
  if p_action='claim' then
    if t.status in ('completed','cancelled','failed') then return to_jsonb(t); end if;
    if t.status='running' and t.lease_until>now() then return to_jsonb(t)||'{"claimed":false}'::jsonb; end if;
    if t.attempt>=3 and t.status='running' then
      update public.consumer_execution_tasks set status='failed',error_code='ATTEMPT_LIMIT',lease=null,lease_until=null,revision=revision+1,updated_at=now() where id=t.id returning * into t;
      return to_jsonb(t);
    end if;
    update public.consumer_execution_tasks set status='running',lease=gen_random_uuid(),lease_until=now()+interval '45 seconds',
      attempt=case when t.status in ('pending','running') then attempt+1 else greatest(attempt,1) end,revision=revision+1,updated_at=now() where id=t.id returning * into t;
    return to_jsonb(t)||'{"claimed":true}'::jsonb;
  end if;
  if t.status<>'running' or t.lease is null or t.lease<>(p_input->>'lease')::uuid or t.lease_until<=now() then
    raise exception 'TASK_CHANGED' using errcode='40001';
  end if;
  if p_action='checkpoint' then
    if coalesce(p_input->>'step','') not in ('context','products','sources','comparison') then raise exception 'INVALID_STEP' using errcode='22023'; end if;
    update public.consumer_execution_tasks set checkpoints=checkpoints||jsonb_build_object(p_input->>'step',p_input->'output'),
      revision=revision+1,updated_at=now() where id=t.id and not(checkpoints ? (p_input->>'step')) returning * into t;
    if not found then select * into t from public.consumer_execution_tasks where id=(p_input->>'id')::uuid; end if;
  elsif p_action='complete' then
    update public.consumer_execution_tasks set status='completed',result=p_input->'result',lease=null,lease_until=null,
      revision=revision+1,updated_at=now() where id=t.id returning * into t;
  elsif p_action='pause' or p_action='fail' then
    update public.consumer_execution_tasks set status=case when p_action='pause' then 'paused' else 'failed' end,
      error_code=p_input->>'errorCode',lease=null,lease_until=null,revision=revision+1,updated_at=now() where id=t.id returning * into t;
  else raise exception 'INVALID_ACTION' using errcode='22023';
  end if;
  return to_jsonb(t);
end $$;
revoke all on function public.manage_consumer_execution(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.manage_consumer_execution(text,jsonb,jsonb) to service_role;

create function public.save_consumer_external_source(p_actor jsonb,p_source jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.consumer_external_sources%rowtype;
begin
  perform private.consumer_owner_key(p_actor);
  perform 1 from public.consumer_execution_tasks where id=(p_source->>'taskId')::uuid
    and owner_key=private.consumer_owner_key(p_actor) and session_id=(p_actor->>'sessionId')::uuid
    and status='running' and lease=(p_source->>'lease')::uuid and lease_until>now() for update;
  if not found then raise exception 'TASK_CHANGED' using errcode='40001'; end if;
  insert into public.consumer_external_sources(user_id,guest_hash,session_id,url,url_hash,title,excerpt,content_hash,expires_at)
  values((p_actor->>'userId')::uuid,p_actor->>'guestHash',(p_actor->>'sessionId')::uuid,p_source->>'url',p_source->>'urlHash',
    p_source->>'title',p_source->>'excerpt',p_source->>'contentHash',now()+case when p_actor->>'userId' is null then interval '1 day' else interval '30 days' end)
  on conflict(owner_key,session_id,url_hash) do update set title=excluded.title,excerpt=excluded.excerpt,
    version=consumer_external_sources.version+case when consumer_external_sources.content_hash<>excluded.content_hash then 1 else 0 end,
    content_hash=excluded.content_hash,fetched_at=now(),expires_at=excluded.expires_at returning * into s;
  return to_jsonb(s);
end $$;
revoke all on function public.save_consumer_external_source(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_consumer_external_source(jsonb,jsonb) to service_role;

create view public.consumer_public_information with(security_barrier=true) as
select case when item_type='service' then 'service' else 'product' end::text as entity_type,id,title,
  left(coalesce(description,''),1200) as excerpt,'/store/'||publisher_slug::text||'/products/'||id::text as url,
  cover_image as image_url,publisher_name as source,created_at as updated_at,1::integer as version
from public.discovery_products
union all
select 'content',p.id,p.title,left(coalesce(p.body::text,''),1200),'/discover?post='||p.id::text,p.cover_url,
  s.name,p.published_at,1 from public.creator_posts p join public.stores s on s.id=p.store_id and s.organization_id=p.organization_id
where p.status='published' and s.status='active' and s.deleted_at is null;
revoke all on public.consumer_public_information from public,anon,authenticated;
grant select on public.consumer_public_information to service_role;

create function public.search_consumer_information(p_actor jsonb,p_query text,p_types text[],p_limit integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$
  with items as (
    select * from public.consumer_public_information
    union all
    select 'source',id,title,left(excerpt,1200),url,null::text,'外部网页',fetched_at,version
    from public.consumer_external_sources where owner_key=private.consumer_owner_key(p_actor)
      and session_id=(p_actor->>'sessionId')::uuid and expires_at>now()
  ),matches as (
    select * from items where entity_type=any(p_types) and (nullif(btrim(p_query),'') is null
      or position(lower(btrim(p_query)) in lower(title||' '||excerpt))>0)
    order by (position(lower(btrim(p_query)) in lower(title))>0) desc,updated_at desc nulls last,entity_type,id limit least(greatest(p_limit,1),50)
  ) select coalesce(jsonb_agg(to_jsonb(matches)),'[]') from matches;
$$;
revoke all on function public.search_consumer_information(jsonb,text,text[],integer) from public,anon,authenticated;
grant execute on function public.search_consumer_information(jsonb,text,text[],integer) to service_role;

create table public.consumer_information_documents (
  entity_type text not null check(entity_type in ('product','service','content','source')),id uuid not null,
  owner_key text not null default '*',session_id uuid,title text not null,excerpt text not null,url text not null,
  image_url text,source text not null,updated_at timestamptz,version integer not null,
  search_vector tsvector generated always as(to_tsvector('simple'::regconfig,title||' '||excerpt)) stored,
  primary key(entity_type,id)
);
create index consumer_information_documents_search_idx on public.consumer_information_documents using gin(search_vector);
create index consumer_information_documents_owner_idx on public.consumer_information_documents(owner_key,session_id,updated_at desc);
alter table public.consumer_information_documents enable row level security;
revoke all on public.consumer_information_documents from public,anon,authenticated;
grant select,insert,update,delete on public.consumer_information_documents to service_role;

create function private.refresh_consumer_information_document(p_kind text,p_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_kind='source' then
    delete from public.consumer_information_documents where entity_type='source' and id=p_id;
    insert into public.consumer_information_documents(entity_type,id,owner_key,session_id,title,excerpt,url,image_url,source,updated_at,version)
      select 'source',id,owner_key,session_id,title,excerpt,url,null,'外部网页',fetched_at,version
      from public.consumer_external_sources where id=p_id;
  else
    delete from public.consumer_information_documents where id=p_id and
      (case when p_kind='catalog' then entity_type in ('product','service') else entity_type='content' end);
    insert into public.consumer_information_documents(entity_type,id,title,excerpt,url,image_url,source,updated_at,version)
      select distinct on(entity_type,id) entity_type,id,title,excerpt,url,image_url,source,updated_at,version
      from public.consumer_public_information where id=p_id and
        (case when p_kind='catalog' then entity_type in ('product','service') else entity_type='content' end)
      order by entity_type,id,url;
  end if;
end $$;
revoke all on function private.refresh_consumer_information_document(text,uuid) from public,anon,authenticated;
grant execute on function private.refresh_consumer_information_document(text,uuid) to service_role;

-- Authorized publisher writes maintain a private derived index; clients never receive index write privileges.
create function private.sync_consumer_information_document() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; item_id uuid;
begin
  row_data:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if TG_TABLE_SCHEMA<>'public' then raise exception 'INVALID_TRIGGER'; end if;
  if TG_TABLE_NAME='consumer_external_sources' then perform private.refresh_consumer_information_document('source',(row_data->>'id')::uuid);
  elsif TG_TABLE_NAME='creator_posts' then perform private.refresh_consumer_information_document('content',(row_data->>'id')::uuid);
  elsif TG_TABLE_NAME='catalog_items' then perform private.refresh_consumer_information_document('catalog',(row_data->>'id')::uuid);
  elsif TG_TABLE_NAME in ('catalog_item_channels','catalog_media','catalog_variants') then
    perform private.refresh_consumer_information_document('catalog',(row_data->>'catalog_item_id')::uuid);
    if TG_OP='UPDATE' and old.catalog_item_id is distinct from new.catalog_item_id then
      perform private.refresh_consumer_information_document('catalog',old.catalog_item_id);
    end if;
  elsif TG_TABLE_NAME='stores' then
    for item_id in select distinct catalog_item_id from public.catalog_item_channels where store_id=(row_data->>'id')::uuid loop
      perform private.refresh_consumer_information_document('catalog',item_id);
    end loop;
    for item_id in select id from public.creator_posts where store_id=(row_data->>'id')::uuid loop
      perform private.refresh_consumer_information_document('content',item_id);
    end loop;
  elsif TG_TABLE_NAME='sales_channels' then
    for item_id in select distinct catalog_item_id from public.catalog_item_channels where channel_id=(row_data->>'id')::uuid loop
      perform private.refresh_consumer_information_document('catalog',item_id);
    end loop;
  end if;
  return null;
end $$;
revoke all on function private.sync_consumer_information_document() from public,anon,authenticated;
create trigger consumer_information_source after insert or update or delete on public.consumer_external_sources for each row execute function private.sync_consumer_information_document();
create trigger consumer_information_content after insert or update or delete on public.creator_posts for each row execute function private.sync_consumer_information_document();
create trigger consumer_information_catalog after insert or update or delete on public.catalog_items for each row execute function private.sync_consumer_information_document();
create trigger consumer_information_channels after insert or update or delete on public.catalog_item_channels for each row execute function private.sync_consumer_information_document();
create trigger consumer_information_media after insert or update or delete on public.catalog_media for each row execute function private.sync_consumer_information_document();
create trigger consumer_information_variants after insert or update or delete on public.catalog_variants for each row execute function private.sync_consumer_information_document();
create trigger consumer_information_stores after update on public.stores for each row execute function private.sync_consumer_information_document();
create trigger consumer_information_sales_channels after update on public.sales_channels for each row execute function private.sync_consumer_information_document();
insert into public.consumer_information_documents(entity_type,id,title,excerpt,url,image_url,source,updated_at,version)
  select distinct on(entity_type,id) entity_type,id,title,excerpt,url,image_url,source,updated_at,version from public.consumer_public_information order by entity_type,id,url;

create or replace function public.search_consumer_information(p_actor jsonb,p_query text,p_types text[],p_limit integer default 20) returns jsonb
language sql stable security invoker set search_path='' as $$
  with candidates as (
    select d.* from public.consumer_information_documents d where entity_type=any(p_types)
      and (owner_key='*' or (owner_key=private.consumer_owner_key(p_actor) and session_id=(p_actor->>'sessionId')::uuid))
      and (nullif(btrim(p_query),'') is null or search_vector@@plainto_tsquery('simple',p_query)
        or not exists(select 1 from regexp_split_to_table(lower(btrim(p_query)),'\s+') word where position(word in lower(title||' '||excerpt))=0))
  ),verified as (
    select p.* from candidates c join public.consumer_public_information p on p.id=c.id and p.entity_type=c.entity_type
    union all
    select 'source',s.id,s.title,left(s.excerpt,1200),s.url,null::text,'外部网页',s.fetched_at,s.version
    from candidates c join public.consumer_external_sources s on c.entity_type='source' and s.id=c.id
      and s.owner_key=private.consumer_owner_key(p_actor) and s.session_id=(p_actor->>'sessionId')::uuid and s.expires_at>now()
  ),matches as (
    select distinct on(entity_type,id) * from verified order by entity_type,id,url
  ),limited as (
    select * from matches order by (position(lower(btrim(p_query)) in lower(title))>0) desc,updated_at desc nulls last,entity_type,id
      limit least(greatest(p_limit,1),50)
  ) select coalesce(jsonb_agg(to_jsonb(limited)),'[]') from limited;
$$;

create function private.prune_consumer_runtime() returns void language plpgsql security invoker set search_path='' as $$
begin
  delete from public.consumer_external_sources where id in (select id from public.consumer_external_sources where expires_at<now() order by expires_at limit 50 for update skip locked);
  delete from public.consumer_execution_tasks where id in (select id from public.consumer_execution_tasks where expires_at<now() order by expires_at limit 50 for update skip locked);
  delete from public.consumer_requests where id in (select id from public.consumer_requests where expires_at<now() order by expires_at limit 50 for update skip locked);
end $$;
revoke all on function private.prune_consumer_runtime() from public,anon,authenticated;
grant execute on function private.prune_consumer_runtime() to service_role;

commit;
