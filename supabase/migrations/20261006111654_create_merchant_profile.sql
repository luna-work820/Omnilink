-- Source-grounded merchant profile storage.
-- ponytail: profile fields stay in JSONB until a product query needs relational indexing.

create table public.merchant_profiles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  profile_version text not null default '0.5.0',
  profile_document jsonb not null default '{}'::jsonb check (jsonb_typeof(profile_document) = 'object'),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.merchant_profile_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.merchant_profiles(id) on delete cascade,
  source_type text not null check (source_type in (
    'merchant_answer', 'document', 'image', 'spreadsheet', 'website',
    'url', 'pasted_text', 'database_record', 'external_registry', 'other'
  )),
  title text,
  uri text,
  storage_path text,
  content_hash text,
  captured_at timestamptz,
  ingest_status text not null default 'pending' check (ingest_status in ('pending', 'processed', 'failed')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.merchant_profile_updates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.merchant_profiles(id) on delete cascade,
  source_id uuid references public.merchant_profile_sources(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'ready_for_review', 'applied', 'rejected', 'failed'
  )),
  change_set jsonb not null default '[]'::jsonb check (jsonb_typeof(change_set) = 'array'),
  error_message text,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index merchant_profile_sources_profile_hash_idx
  on public.merchant_profile_sources (profile_id, content_hash)
  where content_hash is not null;

create index merchant_profile_sources_profile_created_idx
  on public.merchant_profile_sources (profile_id, created_at desc);

create index merchant_profile_updates_profile_status_created_idx
  on public.merchant_profile_updates (profile_id, status, created_at desc);

alter table public.merchant_profiles enable row level security;
alter table public.merchant_profile_sources enable row level security;
alter table public.merchant_profile_updates enable row level security;

create policy merchant_profiles_member_select on public.merchant_profiles
  for select to authenticated
  using (exists (
    select 1
    from public.stores s
    where s.id = store_id
      and private.is_org_member(s.organization_id)
  ));

create policy merchant_profiles_editor_write on public.merchant_profiles
  for all to authenticated
  using (exists (
    select 1
    from public.stores s
    where s.id = store_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ))
  with check (exists (
    select 1
    from public.stores s
    where s.id = store_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ));

create policy merchant_profile_sources_member_select on public.merchant_profile_sources
  for select to authenticated
  using (exists (
    select 1
    from public.merchant_profiles p
    join public.stores s on s.id = p.store_id
    where p.id = profile_id
      and private.is_org_member(s.organization_id)
  ));

create policy merchant_profile_sources_editor_write on public.merchant_profile_sources
  for all to authenticated
  using (exists (
    select 1
    from public.merchant_profiles p
    join public.stores s on s.id = p.store_id
    where p.id = profile_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ))
  with check (exists (
    select 1
    from public.merchant_profiles p
    join public.stores s on s.id = p.store_id
    where p.id = profile_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ));

create policy merchant_profile_updates_member_select on public.merchant_profile_updates
  for select to authenticated
  using (exists (
    select 1
    from public.merchant_profiles p
    join public.stores s on s.id = p.store_id
    where p.id = profile_id
      and private.is_org_member(s.organization_id)
  ));

create policy merchant_profile_updates_editor_write on public.merchant_profile_updates
  for all to authenticated
  using (exists (
    select 1
    from public.merchant_profiles p
    join public.stores s on s.id = p.store_id
    where p.id = profile_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ))
  with check (exists (
    select 1
    from public.merchant_profiles p
    join public.stores s on s.id = p.store_id
    where p.id = profile_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ));
