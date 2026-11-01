create table public.consumer_agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null default 'personal-advisor',
  skill_version text not null default '1.0.0',
  goal text not null check (length(goal) between 1 and 2000),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  status text not null default 'waiting_for_user' check (status in ('waiting_for_user', 'running', 'completed', 'failed', 'cancelled')),
  question text,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  error_message text,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index consumer_agent_tasks_id_user_idx on public.consumer_agent_tasks(id, user_id);

create table public.consumer_agent_task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null,
  step_no integer not null check (step_no > 0),
  label text not null,
  status text not null check (status in ('pending', 'running', 'waiting_for_user', 'completed', 'failed', 'skipped')),
  output_summary text,
  updated_at timestamptz not null default now(),
  unique (task_id, step_no),
  foreign key (task_id, user_id) references public.consumer_agent_tasks(id, user_id) on delete cascade
);

create index consumer_agent_tasks_user_updated_idx on public.consumer_agent_tasks(user_id, updated_at desc);
create index consumer_agent_task_steps_user_task_idx on public.consumer_agent_task_steps(user_id, task_id, step_no);

alter table public.consumer_agent_tasks enable row level security;
alter table public.consumer_agent_task_steps enable row level security;

revoke all on public.consumer_agent_tasks from anon, authenticated;
revoke all on public.consumer_agent_task_steps from anon, authenticated;
grant select, insert, update on public.consumer_agent_tasks to authenticated;
grant select, insert, update on public.consumer_agent_task_steps to authenticated;

create policy consumer_agent_tasks_own_select on public.consumer_agent_tasks
  for select to authenticated using (user_id = (select auth.uid()));
create policy consumer_agent_tasks_own_insert on public.consumer_agent_tasks
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy consumer_agent_tasks_own_update on public.consumer_agent_tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy consumer_agent_task_steps_own_select on public.consumer_agent_task_steps
  for select to authenticated using (user_id = (select auth.uid()));
create policy consumer_agent_task_steps_own_insert on public.consumer_agent_task_steps
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy consumer_agent_task_steps_own_update on public.consumer_agent_task_steps
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
