begin;

-- Only result references and execution metadata; the catalog remains the source of facts.
alter table public.consumer_discovery_runs add column execution jsonb;
alter table public.consumer_discovery_runs add constraint consumer_discovery_execution_shape
  check (execution is null or coalesce((execution->>'catalogVersion' = 'five-store-v1'
    and jsonb_typeof(execution->'candidateKeys') = 'array'
    and jsonb_array_length(execution->'candidateKeys') <= 1000),false));

create or replace function public.create_consumer_discovery_run(p_record jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare run_id uuid := (p_record->>'id')::uuid;
begin
  delete from public.consumer_discovery_runs where id in (
    select id from public.consumer_discovery_runs where expires_at<now() order by expires_at limit 100 for update skip locked);
  insert into public.consumer_discovery_runs(id,user_id,guest_hash,session_id,spec,candidate_ids,context_version,expires_at,execution)
  values(run_id,(p_record->>'user_id')::uuid,p_record->>'guest_hash',(p_record->>'session_id')::uuid,p_record->'spec',
    array(select jsonb_array_elements_text(coalesce(p_record->'candidate_ids','[]'))::uuid),(p_record->>'context_version')::bigint,
    least((p_record->>'expires_at')::timestamptz,now()+interval '15 minutes'),p_record->'execution');
  return run_id;
end;
$$;

create function public.read_consumer_discovery_execution(p_run_id uuid,p_user_id uuid,p_guest_hash text,p_session_id uuid,p_version bigint)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare r public.consumer_discovery_runs%rowtype;
begin
  select * into r from public.consumer_discovery_runs where id=p_run_id and session_id=p_session_id
    and ((p_user_id is not null and user_id=p_user_id) or (p_user_id is null and user_id is null and guest_hash=p_guest_hash));
  if not found then raise exception 'SEARCH_NOT_FOUND' using errcode='P0002'; end if;
  if r.expires_at<=statement_timestamp() then raise exception 'SEARCH_EXPIRED'; end if;
  if p_version<>r.context_version or r.context_version<>coalesce((select version from public.consumer_context_versions where user_id=p_user_id),0) then
    raise exception 'CONTEXT_CHANGED' using errcode='40001';
  end if;
  if r.execution is null then raise exception 'SEARCH_EXPIRED'; end if;
  return jsonb_build_object('id',r.id,'sessionId',r.session_id,'spec',r.spec,'contextVersion',r.context_version,
    'expiresAt',r.expires_at,'execution',r.execution);
end;
$$;
revoke all on function public.read_consumer_discovery_execution(uuid,uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.read_consumer_discovery_execution(uuid,uuid,text,uuid,bigint) to service_role;

create function public.get_consumer_task_context(p_user_id uuid,p_domains text[]) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('version',coalesce((select version from public.consumer_context_versions where user_id=p_user_id),0),
    'memories',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'domain',domain,'text',text,'origin',origin,'status',status,'confirmedAt',confirmed_at,
      'evidence',evidence,'sourceMessageId',source_message_id,'supportIds',support_ids,'supersedeIds',supersede_ids,
      'revision',revision,'sourceKind',source_kind,
      'sourcePayload',jsonb_build_object('preferenceSignals',source_payload->'preferenceSignals')) order by case when domain='other' and cardinality(p_domains)>1 then 1 else 0 end,updated_at desc,id)
    from (select * from public."consumer_AI assistant_memories" where user_id=p_user_id and status='active'
      and confirmed_by=p_user_id and confirmed_at is not null and domain=any(p_domains)
      order by case when domain='other' and cardinality(p_domains)>1 then 1 else 0 end,updated_at desc,id limit 12) relevant),'[]'::jsonb));
$$;
revoke all on function public.get_consumer_task_context(uuid,text[]) from public,anon,authenticated;
grant execute on function public.get_consumer_task_context(uuid,text[]) to service_role;
commit;
