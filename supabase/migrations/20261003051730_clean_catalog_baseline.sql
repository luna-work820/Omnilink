-- OmniLink clean Catalog baseline.
-- The legacy product/semantic migrations are archived locally and are not part
-- of the active database history anymore.

create extension if not exists citext with schema extensions;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug extensions.citext not null unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug extensions.citext not null,
  currency char(3) not null default 'CNY',
  locale text not null default 'zh-CN',
  created_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create schema if not exists private;

create or replace function private.is_org_member(
  p_organization_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

revoke all on function private.is_org_member(uuid, text[]) from public;
grant execute on function private.is_org_member(uuid, text[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.stores enable row level security;

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select to authenticated using (private.is_org_member(id));

drop policy if exists organization_members_member_select on public.organization_members;
create policy organization_members_member_select on public.organization_members
  for select to authenticated using (private.is_org_member(organization_id));

drop policy if exists stores_member_select on public.stores;
create policy stores_member_select on public.stores
  for select to authenticated using (private.is_org_member(organization_id));

drop policy if exists stores_editor_write on public.stores;
create policy stores_editor_write on public.stores
  for all to authenticated
  using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create index if not exists organization_members_user_idx
  on public.organization_members (user_id, status);

create index if not exists stores_organization_idx
  on public.stores (organization_id, created_at desc);
