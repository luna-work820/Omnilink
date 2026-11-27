begin;

create function public.finish_consumer_discovery_request(p_actor jsonb, p_request jsonb, p_record jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
  if (p_record->>'session_id')::uuid is distinct from (p_actor->>'sessionId')::uuid
    or (p_record->>'user_id')::uuid is distinct from (p_actor->>'userId')::uuid
    or (p_record->>'guest_hash') is distinct from (p_actor->>'guestHash') then
    raise exception 'ACTOR_MISMATCH' using errcode='22023';
  end if;
  perform public.create_consumer_discovery_run(p_record);
  return public.manage_consumer_request('finish', p_actor, p_request);
end;
$$;

revoke all on function public.finish_consumer_discovery_request(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finish_consumer_discovery_request(jsonb,jsonb,jsonb) to service_role;
commit;
