-- Omnilink V1 brand workspace schema
-- Canonical flow:
--   auth.users -> profiles -> brand_projects -> brand_assets / brand_recommendations
-- This migration intentionally does not reuse the previous storefront/store schema.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  onboarding_status text not null default 'pending'
    check (onboarding_status in ('pending', 'started', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  concept text,
  category text,
  logo_url text,
  style text not null default 'y2k' check (style = 'y2k'),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  selected_template text not null default 'tpl-y2k-neon',
  palette jsonb not null default '[]'::jsonb,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.brand_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null default 'brand-image',
  storage_path text,
  url text,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_recommendations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.brand_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  product_url text,
  reason text,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists brand_projects_user_created_idx
  on public.brand_projects (user_id, created_at desc);
create index if not exists brand_assets_project_order_idx
  on public.brand_assets (project_id, sort_order);
create index if not exists brand_recommendations_project_position_idx
  on public.brand_recommendations (project_id, position);

-- Existing v0.4 bootstrap function targets a different schema and references
-- organizations.owner_id, which does not exist in its own table definition.
-- V1 does not use that RPC; remove it rather than leaving a broken public API.
drop function if exists public.create_organization_and_store(text, text, text, text, text);

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure private.handle_new_user_profile();

-- Backfill profiles for users created before this migration.
insert into public.profiles (id, email, display_name)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

alter table public.profiles enable row level security;
alter table public.brand_projects enable row level security;
alter table public.brand_assets enable row level security;
alter table public.brand_recommendations enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists brand_projects_select_own on public.brand_projects;
create policy brand_projects_select_own on public.brand_projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists brand_projects_insert_own on public.brand_projects;
create policy brand_projects_insert_own on public.brand_projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists brand_projects_update_own on public.brand_projects;
create policy brand_projects_update_own on public.brand_projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists brand_projects_delete_own on public.brand_projects;
create policy brand_projects_delete_own on public.brand_projects
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists brand_assets_select_own on public.brand_assets;
create policy brand_assets_select_own on public.brand_assets
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists brand_assets_insert_own on public.brand_assets;
create policy brand_assets_insert_own on public.brand_assets
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.brand_projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists brand_assets_delete_own on public.brand_assets;
create policy brand_assets_delete_own on public.brand_assets
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists brand_recommendations_select_own on public.brand_recommendations;
create policy brand_recommendations_select_own on public.brand_recommendations
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists brand_recommendations_insert_own on public.brand_recommendations;
create policy brand_recommendations_insert_own on public.brand_recommendations
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.brand_projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    )
  );

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.brand_projects to authenticated;
grant select, insert, delete on public.brand_assets to authenticated;
grant select, insert on public.brand_recommendations to authenticated;
