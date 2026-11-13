begin;

alter table public."consumer_AI assistant_memories"
  drop constraint if exists consumer_eva_memories_status_check;
alter table public."consumer_AI assistant_memories"
  add column if not exists source_kind text not null default 'legacy',
  add column if not exists source_payload jsonb not null default '{}',
  add column if not exists original_text text,
  add column if not exists supersede_ids uuid[] not null default '{}',
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references auth.users(id) on delete cascade,
  add column if not exists revision integer not null default 1;

-- Old active rows have no confirmation evidence. Preserve them for review.
update public."consumer_AI assistant_memories"
set original_text = coalesce(original_text, text),
    source_payload = source_payload || jsonb_build_object('legacy_status', status),
    status = case when status = 'active' and confirmed_at is null then 'proposed' else status end
where original_text is null;

-- Metadata is user-editable; importing it may create proposals, never active memory.
insert into public."consumer_AI assistant_memories"
  (id, user_id, domain, text, origin, status, source_kind, evidence, original_text)
select (m->>'id')::uuid, u.id, m->>'domain', btrim(m->>'text'),
  case when m->>'origin' = 'inferred' then 'inferred' else 'user' end,
  'proposed', 'legacy', '旧个人资料中的记忆，待确认', btrim(m->>'text')
from auth.users u
cross join lateral jsonb_array_elements(case
  when jsonb_typeof(u.raw_user_meta_data->'ai_assistant_profile'->'memories') = 'array'
  then u.raw_user_meta_data->'ai_assistant_profile'->'memories' else '[]'::jsonb end) m
where m->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and m->>'domain' in ('clothing','skin','hair','space','other')
  and char_length(btrim(m->>'text')) between 1 and 240
on conflict (id) do nothing;

alter table public."consumer_AI assistant_memories" alter column status set default 'proposed';
alter table public."consumer_AI assistant_memories" alter column original_text set not null;
alter table public."consumer_AI assistant_memories"
  add constraint consumer_memory_status_check check (status in ('proposed','active','rejected')),
  add constraint consumer_memory_confirmation_check check
    (status <> 'active' or (confirmed_at is not null and confirmed_by is not null and confirmed_by = user_id)),
  add constraint consumer_memory_source_check check (source_kind in ('manual','chat','assessment','legacy')),
  add constraint consumer_memory_revision_check check (revision > 0),
  add constraint consumer_memory_payload_size_check check (octet_length(source_payload::text) <= 32768);

with duplicates as (
  select id, row_number() over (partition by user_id, domain, lower(regexp_replace(btrim(text), '\s+', ' ', 'g'))
    order by (status = 'active') desc, updated_at desc, id) as position
  from public."consumer_AI assistant_memories" where status in ('proposed','active')
)
update public."consumer_AI assistant_memories" m set status = 'rejected'
from duplicates d where m.id = d.id and d.position > 1;

create unique index consumer_memory_live_text_idx on public."consumer_AI assistant_memories"
  (user_id, domain, lower(regexp_replace(btrim(text), '\s+', ' ', 'g')))
  where status in ('proposed','active');

revoke all on public."consumer_AI assistant_memories" from public, anon, authenticated;
grant select on public."consumer_AI assistant_memories" to authenticated;
grant select, insert, update, delete on public."consumer_AI assistant_memories" to service_role;

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
        and lower(regexp_replace(btrim(m.text),'\s+',' ','g')) = lower(regexp_replace(memory_text,'\s+',' ','g'));
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
    status = case when p_action = 'reject' then 'rejected' else 'active' end,
    confirmed_at = case when p_action = 'reject' then confirmed_at else now() end,
    confirmed_by = case when p_action = 'reject' then confirmed_by else p_user_id end,
    updated_at = now(), revision = revision + 1
    where id = item.id and user_id = p_user_id returning * into item;
  return to_jsonb(item);
end;
$$;
revoke all on function private.manage_consumer_memory(uuid,text,jsonb) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.manage_consumer_memory(uuid,text,jsonb) to service_role;

create or replace function public.manage_consumer_memory(p_user_id uuid,p_action text,p_input jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.manage_consumer_memory(p_user_id,p_action,p_input); $$;
revoke all on function public.manage_consumer_memory(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.manage_consumer_memory(uuid,text,jsonb) to service_role;

commit;
