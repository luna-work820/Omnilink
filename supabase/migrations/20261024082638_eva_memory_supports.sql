alter table public.consumer_eva_memories
  add column support_ids uuid[] not null default '{}';

create index consumer_eva_memories_support_ids_idx
  on public.consumer_eva_memories using gin (support_ids);
