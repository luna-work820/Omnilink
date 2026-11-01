create table public.consumer_eva_messages (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 5000),
  style_tag text,
  matched_product_ids text[] not null default '{}',
  model text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index consumer_eva_messages_user_time_idx
  on public.consumer_eva_messages (user_id, created_at desc);
create index consumer_eva_messages_conversation_idx
  on public.consumer_eva_messages (user_id, conversation_id, created_at);

create table public.consumer_eva_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('clothing', 'skin', 'hair', 'space', 'other')),
  text text not null check (char_length(text) between 1 and 240),
  origin text not null check (origin in ('user', 'inferred')),
  status text not null default 'active' check (status in ('active', 'rejected')),
  evidence text,
  source_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index consumer_eva_memories_user_status_idx
  on public.consumer_eva_memories (user_id, status, updated_at desc);

alter table public.consumer_eva_messages enable row level security;
alter table public.consumer_eva_memories enable row level security;

revoke all on public.consumer_eva_messages from anon, authenticated;
revoke all on public.consumer_eva_memories from anon, authenticated;
grant select, insert, delete on public.consumer_eva_messages to authenticated;
grant select, insert, update, delete on public.consumer_eva_memories to authenticated;

create policy consumer_eva_messages_select on public.consumer_eva_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy consumer_eva_messages_insert on public.consumer_eva_messages
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy consumer_eva_messages_delete on public.consumer_eva_messages
  for delete to authenticated using (user_id = (select auth.uid()));

create policy consumer_eva_memories_select on public.consumer_eva_memories
  for select to authenticated using (user_id = (select auth.uid()));
create policy consumer_eva_memories_insert on public.consumer_eva_memories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy consumer_eva_memories_update on public.consumer_eva_memories
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy consumer_eva_memories_delete on public.consumer_eva_memories
  for delete to authenticated using (user_id = (select auth.uid()));
