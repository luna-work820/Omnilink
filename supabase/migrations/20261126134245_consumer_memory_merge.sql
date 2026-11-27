begin;

create function public.propose_consumer_skin_merge(p_user_id uuid, p_first text, p_second text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  a public."consumer_AI assistant_memories"%rowtype;
  b public."consumer_AI assistant_memories"%rowtype;
  first_message public."consumer_AI assistant_messages"%rowtype;
  second_message public."consumer_AI assistant_messages"%rowtype;
  combined text;
  existing public."consumer_AI assistant_memories"%rowtype;
  replacements uuid[] := '{}'::uuid[];
  revisions jsonb := '{}'::jsonb;
  result jsonb;
begin
  if current_user <> 'service_role' or p_user_id is null then
    raise exception 'Verified server caller required' using errcode='42501';
  end if;
  if p_first is null or p_second is null or p_first=p_second then return jsonb_build_object('status','unavailable'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select * into first_message from public."consumer_AI assistant_messages" where user_id=p_user_id and id=p_first and role='user';
  if not found then return jsonb_build_object('status','unavailable'); end if;
  select * into second_message from public."consumer_AI assistant_messages" where user_id=p_user_id and id=p_second and role='user';
  if not found or first_message.conversation_id is distinct from second_message.conversation_id then return jsonb_build_object('status','unavailable'); end if;
  select * into a from public."consumer_AI assistant_memories" where user_id=p_user_id and domain='skin' and origin='user'
    and status in ('proposed','active') and source_message_id=p_first
    and source_payload->>'factKey' in ('skin:moisture:t区','skin:moisture:脸颊') limit 1;
  if not found or position(a.text in first_message.content)=0 then return jsonb_build_object('status','unavailable'); end if;
  select * into b from public."consumer_AI assistant_memories" where user_id=p_user_id and domain='skin' and origin='user'
    and status in ('proposed','active') and source_message_id=p_second
    and source_payload->>'factKey' in ('skin:moisture:t区','skin:moisture:脸颊') limit 1;
  if not found or position(b.text in second_message.content)=0 or a.source_payload->>'factKey'=b.source_payload->>'factKey' then return jsonb_build_object('status','unavailable'); end if;
  combined := rtrim(a.text, '。！!') || '；' || rtrim(b.text, '。！!');
  if char_length(combined)>240 then return jsonb_build_object('status','unavailable'); end if;
  select * into existing from public."consumer_AI assistant_memories" where user_id=p_user_id and domain='skin' and text=combined order by updated_at desc limit 1;
  if found then return jsonb_build_object('id',existing.id,'status',existing.status); end if;
  if a.status='active' then replacements:=array_append(replacements,a.id); revisions:=revisions || jsonb_build_object(a.id::text,a.revision); end if;
  if b.status='active' then replacements:=array_append(replacements,b.id); revisions:=revisions || jsonb_build_object(b.id::text,b.revision); end if;
  result := private.manage_consumer_memory(p_user_id,'propose',jsonb_build_object(
    'text',combined,'domain','skin','origin','user','sourceKind','chat','sourceMessageId',p_second,
    'evidence','根据你的两次回答整理','supersedeIds',to_jsonb(replacements),
    'sourcePayload',jsonb_build_object('kind','skin-multi-source','observations',jsonb_build_array(p_first,p_second),
      'constituents',jsonb_build_array(a.id,b.id),'conflictRevisions',revisions,
      'lifecycle',jsonb_build_object('subject','self','scope','long-term','expiresAt',null))));
  return result;
end;
$$;
revoke all on function public.propose_consumer_skin_merge(uuid,text,text) from public,anon,authenticated;
grant execute on function public.propose_consumer_skin_merge(uuid,text,text) to service_role;
commit;
