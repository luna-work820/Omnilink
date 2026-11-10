-- Rename the active consumer assistant schema while preserving user data.
-- The requested table names contain a space and uppercase AI, so they are quoted.
alter table public.consumer_eva_memories
  rename to "consumer_AI assistant_memories";

alter table public.consumer_eva_messages
  rename to "consumer_AI assistant_messages";

alter table public."consumer_AI assistant_memories"
  rename constraint consumer_eva_memories_pkey to ai_assistant_memories_pkey;
alter table public."consumer_AI assistant_memories"
  rename constraint consumer_eva_memories_user_id_fkey to ai_assistant_memories_user_id_fkey;
alter table public."consumer_AI assistant_messages"
  rename constraint consumer_eva_messages_pkey to ai_assistant_messages_pkey;
alter table public."consumer_AI assistant_messages"
  rename constraint consumer_eva_messages_user_id_fkey to ai_assistant_messages_user_id_fkey;

alter index public.consumer_eva_memories_user_status_idx rename to ai_assistant_memories_user_status_idx;
alter index public.consumer_eva_memories_support_ids_idx rename to ai_assistant_memories_support_ids_idx;
alter index public.consumer_eva_messages_user_time_idx rename to ai_assistant_messages_user_time_idx;
alter index public.consumer_eva_messages_conversation_idx rename to ai_assistant_messages_conversation_idx;

alter policy consumer_eva_memories_select on public."consumer_AI assistant_memories" rename to ai_assistant_memories_select;
alter policy consumer_eva_memories_insert on public."consumer_AI assistant_memories" rename to ai_assistant_memories_insert;
alter policy consumer_eva_memories_update on public."consumer_AI assistant_memories" rename to ai_assistant_memories_update;
alter policy consumer_eva_memories_delete on public."consumer_AI assistant_memories" rename to ai_assistant_memories_delete;
alter policy consumer_eva_messages_select on public."consumer_AI assistant_messages" rename to ai_assistant_messages_select;
alter policy consumer_eva_messages_insert on public."consumer_AI assistant_messages" rename to ai_assistant_messages_insert;
alter policy consumer_eva_messages_delete on public."consumer_AI assistant_messages" rename to ai_assistant_messages_delete;

-- Move the existing profile and onboarding flags to their new metadata keys.
update auth.users as users
set raw_user_meta_data =
  (coalesce(users.raw_user_meta_data, '{}'::jsonb)
    - 'eva_profile'
    - 'eva_onboarding_started'
    - 'eva_onboarding_complete')
  || case when users.raw_user_meta_data ? 'eva_profile'
         and not (users.raw_user_meta_data ? 'ai_assistant_profile')
       then jsonb_build_object('ai_assistant_profile', users.raw_user_meta_data->'eva_profile')
       else '{}'::jsonb end
  || case when users.raw_user_meta_data ? 'eva_onboarding_started'
         and not (users.raw_user_meta_data ? 'ai_assistant_onboarding_started')
       then jsonb_build_object('ai_assistant_onboarding_started', users.raw_user_meta_data->'eva_onboarding_started')
       else '{}'::jsonb end
  || case when users.raw_user_meta_data ? 'eva_onboarding_complete'
         and not (users.raw_user_meta_data ? 'ai_assistant_onboarding_complete')
       then jsonb_build_object('ai_assistant_onboarding_complete', users.raw_user_meta_data->'eva_onboarding_complete')
       else '{}'::jsonb end
where coalesce(users.raw_user_meta_data, '{}'::jsonb) ?| array[
  'eva_profile', 'eva_onboarding_started', 'eva_onboarding_complete'
];
