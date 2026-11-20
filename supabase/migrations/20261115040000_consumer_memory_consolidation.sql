begin;

grant select on public."consumer_AI assistant_messages" to service_role;

create function private.valid_consumer_memory_lifecycle(payload jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare lifecycle jsonb := payload->'lifecycle'; deadline timestamptz;
begin
  if lifecycle is null then return true; end if;
  if jsonb_typeof(lifecycle) <> 'object'
    or coalesce(lifecycle->>'subject','') not in ('self','other')
    or coalesce(lifecycle->>'scope','') not in ('long-term','temporary')
    or not lifecycle ? 'expiresAt' then return false; end if;
  if lifecycle->>'expiresAt' is not null then
    deadline := (lifecycle->>'expiresAt')::timestamptz;
    if not isfinite(deadline) then return false; end if;
  elsif lifecycle->>'scope'='temporary' then return false;
  end if;
  return true;
exception when others then return false;
end;
$$;
revoke all on function private.valid_consumer_memory_lifecycle(jsonb) from public,anon,authenticated;
grant execute on function private.valid_consumer_memory_lifecycle(jsonb) to service_role;
alter table public."consumer_AI assistant_memories" add constraint consumer_memory_lifecycle_check
  check(private.valid_consumer_memory_lifecycle(source_payload));

create table public.consumer_memory_processed_sources (
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id text not null,
  processed_at timestamptz not null default now(),
  primary key(user_id, message_id)
);
alter table public.consumer_memory_processed_sources enable row level security;
revoke all on public.consumer_memory_processed_sources from public, anon, authenticated;
grant select, insert, delete on public.consumer_memory_processed_sources to service_role;

create function public.consolidate_consumer_memory(p_user_id uuid, p_message_id text, p_candidate jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  source_text text;
  existing public."consumer_AI assistant_memories"%rowtype;
  result jsonb;
  conflicts uuid[];
  conflict_revisions jsonb;
  payload jsonb := p_candidate->'sourcePayload';
  candidate_text text := btrim(p_candidate->>'text');
begin
  if current_user <> 'service_role' or p_user_id is null then
    raise exception 'Verified server caller required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select content into source_text from public."consumer_AI assistant_messages"
    where user_id=p_user_id and id=p_message_id and role='user';
  if not found then raise exception 'Memory source not found' using errcode='P0002'; end if;
  if exists(select 1 from public.consumer_memory_processed_sources where user_id=p_user_id and message_id=p_message_id) then
    return jsonb_build_object('status','processed');
  end if;
  if candidate_text is null or char_length(candidate_text) not between 1 and 120
    or p_candidate->>'origin' is distinct from 'user'
    or p_candidate->>'evidence' is distinct from source_text
    or position(candidate_text in source_text)=0
    or payload->'lifecycle' is distinct from '{"subject":"self","scope":"long-term","expiresAt":null}'::jsonb
    or coalesce(payload->>'polarity','') not in ('positive','negative')
    or coalesce(length(payload->>'factKey'),0) not between 1 and 80 then
    raise exception 'Invalid memory evidence' using errcode='22023';
  end if;

  -- Rejected statements stay rejected, including when another conversation
  -- repeats them. Only a deliberate manual save can reactivate the preference.
  select * into existing from public."consumer_AI assistant_memories"
    where user_id=p_user_id and domain=p_candidate->>'domain'
      and (lower(regexp_replace(btrim(text),'\s+',' ','g'))=lower(regexp_replace(candidate_text,'\s+',' ','g'))
        or (source_payload->>'factKey'=payload->>'factKey' and source_payload->>'polarity'=payload->>'polarity'))
    order by (status='active') desc, updated_at desc limit 1;
  if found then
    if existing.status <> 'rejected' then
      update public."consumer_AI assistant_memories" set source_payload=source_payload || jsonb_build_object(
        'observations', (select coalesce(jsonb_agg(value),'[]') from (
          select distinct value from jsonb_array_elements(coalesce(existing.source_payload->'observations','[]')
            || jsonb_build_array(p_message_id::text)) limit 20) observations))
      where id=existing.id and user_id=p_user_id;
    end if;
    result := jsonb_build_object('id',existing.id,'status',existing.status);
  else
    select coalesce(array_agg(id),'{}'::uuid[]),coalesce(jsonb_object_agg(id::text,revision),'{}'::jsonb)
      into conflicts, conflict_revisions from public."consumer_AI assistant_memories"
      where user_id=p_user_id and domain=p_candidate->>'domain' and status='active'
        and confirmed_at is not null
        and coalesce(source_payload->'lifecycle'->>'subject','self')='self'
        and (source_payload->'lifecycle'->>'expiresAt' is null
          or (source_payload->'lifecycle'->>'expiresAt')::timestamptz>statement_timestamp())
        and (source_payload->>'factKey'=payload->>'factKey'
          or (text ~ '^(我(一直|平时|通常)?)?(不喜欢|喜欢|偏好)'
            and lower(regexp_replace(regexp_replace(regexp_replace(btrim(text),
              '^(我(一直|平时|通常)?)?(不喜欢|喜欢|偏好)','','g'),'[。！!]$','','g'),'\s+','','g'))=payload->>'factKey'))
        and coalesce(source_payload->>'polarity',case when text ~ '^(我(一直|平时|通常)?)?不喜欢' then 'negative' else 'positive' end)<>payload->>'polarity';
    result := private.manage_consumer_memory(p_user_id,'propose',p_candidate || jsonb_build_object(
      'sourceKind','chat','sourceMessageId',p_message_id::text,'supersedeIds',to_jsonb(conflicts),
      'sourcePayload',payload || jsonb_build_object('observations',jsonb_build_array(p_message_id::text),
        'conflictRevisions',conflict_revisions)));
  end if;
  insert into public.consumer_memory_processed_sources(user_id,message_id) values(p_user_id,p_message_id);
  return result;
end;
$$;
revoke all on function public.consolidate_consumer_memory(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.consolidate_consumer_memory(uuid,text,jsonb) to service_role;

-- Keep the original write state machine and its dependency invalidation. A
-- conflict proposal must not replace a preference edited after it was proposed.
create or replace function public.manage_consumer_memory(p_user_id uuid,p_action text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare refs jsonb; item_status text; result jsonb;
begin
  if current_user <> 'service_role' or p_user_id is null then
    raise exception 'Verified server caller required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  if p_action in ('confirm','correct') then
    select source_payload->'conflictRevisions',status into refs,item_status from public."consumer_AI assistant_memories"
      where user_id=p_user_id and id=(p_input->>'id')::uuid;
    if p_action='confirm' and item_status='active' then
      return private.manage_consumer_memory(p_user_id,p_action,p_input);
    end if;
    if exists(select 1 from jsonb_each_text(coalesce(refs,'{}')) r
      where not exists(select 1 from public."consumer_AI assistant_memories" m
        where m.user_id=p_user_id and m.id=r.key::uuid and m.status='active' and m.revision=r.value::integer)) then
      raise exception 'Conflicting memory changed; review again' using errcode='40001';
    end if;
  end if;
  result := private.manage_consumer_memory(p_user_id,p_action,p_input);
  if p_action='manual' and p_input->'sourcePayload' ? 'lifecycle' then
    update public."consumer_AI assistant_memories" set source_payload=source_payload || jsonb_build_object(
      'lifecycle',p_input->'sourcePayload'->'lifecycle'), revision=revision+1
      where user_id=p_user_id and id=(result->>'id')::uuid
        and source_payload->'lifecycle' is distinct from p_input->'sourcePayload'->'lifecycle';
  end if;
  if p_action='correct' then
    update public."consumer_AI assistant_memories" set source_payload=source_payload-'factKey'-'polarity'-'conflictRevisions'
      where user_id=p_user_id and id=(p_input->>'id')::uuid;
  end if;
  if p_action in ('manual','correct') then
    select to_jsonb(m) into result from public."consumer_AI assistant_memories" m
      where m.user_id=p_user_id and m.id=(result->>'id')::uuid;
  end if;
  return result;
end;
$$;

-- Expiry uses the original state machine so dependent inferences and cached
-- search context versions are invalidated together on the next context read.
create function private.expire_consumer_memories(p_user_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare item record;
begin
  if current_user <> 'service_role' then raise exception 'Verified server caller required' using errcode='42501'; end if;
  if not exists(select 1 from public."consumer_AI assistant_memories" where user_id=p_user_id and status in ('active','proposed')
    and source_payload->'lifecycle'->>'expiresAt' is not null
    and (source_payload->'lifecycle'->>'expiresAt')::timestamptz<=statement_timestamp()) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  for item in select id from public."consumer_AI assistant_memories" where user_id=p_user_id and status in ('active','proposed')
    and source_payload->'lifecycle'->>'expiresAt' is not null
    and (source_payload->'lifecycle'->>'expiresAt')::timestamptz<=statement_timestamp()
  loop
    perform private.manage_consumer_memory(p_user_id,'reject',jsonb_build_object('id',item.id));
  end loop;
end;
$$;
revoke all on function private.expire_consumer_memories(uuid) from public,anon,authenticated;
grant execute on function private.expire_consumer_memories(uuid) to service_role;

-- Lifecycle metadata is projected with the existing snapshot, never a second profile.
create or replace function public.get_consumer_task_context(p_user_id uuid,p_domains text[]) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
begin
  perform private.expire_consumer_memories(p_user_id);
  return (select jsonb_build_object('version',coalesce((select version from public.consumer_context_versions where user_id=p_user_id),0),
    'memories',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'domain',domain,'text',text,'origin',origin,'status',status,'confirmedAt',confirmed_at,
      'evidence',evidence,'sourceMessageId',source_message_id,'supportIds',support_ids,'supersedeIds',supersede_ids,
      'revision',revision,'sourceKind',source_kind,
      'sourcePayload',jsonb_build_object('preferenceSignals',source_payload->'preferenceSignals','lifecycle',
        coalesce(source_payload->'lifecycle','{"subject":"self","scope":"long-term","expiresAt":null}'::jsonb)))
      order by case when domain='other' and cardinality(p_domains)>1 then 1 else 0 end,updated_at desc,id)
    from (select * from public."consumer_AI assistant_memories" where user_id=p_user_id and status='active'
      and confirmed_by=p_user_id and confirmed_at is not null and domain=any(p_domains)
      and coalesce(source_payload->'lifecycle'->>'subject','self')='self'
      and (source_payload->'lifecycle'->>'expiresAt' is null
        or (source_payload->'lifecycle'->>'expiresAt')::timestamptz>statement_timestamp())
      order by case when domain='other' and cardinality(p_domains)>1 then 1 else 0 end,updated_at desc,id limit 12) relevant),'[]'::jsonb)));
end;
$$;
create or replace function public.get_consumer_context_snapshot(p_user_id uuid) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
begin
  perform private.expire_consumer_memories(p_user_id);
  return (select jsonb_build_object('version',coalesce((select version from public.consumer_context_versions where user_id=p_user_id),0),
    'memories',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'domain',domain,'text',text,'origin',origin,'status',status,'confirmedAt',confirmed_at,
      'evidence',evidence,'sourceMessageId',source_message_id,'supportIds',support_ids,'supersedeIds',supersede_ids,
      'revision',revision,'sourceKind',source_kind,
      'sourcePayload',jsonb_build_object('preferenceSignals',source_payload->'preferenceSignals','lifecycle',
        coalesce(source_payload->'lifecycle','{"subject":"self","scope":"long-term","expiresAt":null}'::jsonb)))
      order by updated_at desc,id)
    from (select * from public."consumer_AI assistant_memories" where user_id=p_user_id and status='active'
      and confirmed_by=p_user_id and confirmed_at is not null
      and coalesce(source_payload->'lifecycle'->>'subject','self')='self'
      and (source_payload->'lifecycle'->>'expiresAt' is null
        or (source_payload->'lifecycle'->>'expiresAt')::timestamptz>statement_timestamp())
      order by updated_at desc,id limit 50) relevant),'[]'::jsonb)));
end;
$$;
commit;
