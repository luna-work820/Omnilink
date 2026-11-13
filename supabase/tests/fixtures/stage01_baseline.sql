create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema private;
create schema storage;
grant usage on schema public, auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.organizations (id uuid primary key);
create table public.stores (
  id uuid primary key, organization_id uuid not null references public.organizations(id),
  name text, slug text, currency text default 'CNY', unique(id, organization_id)
);
create table public.organization_members (
  organization_id uuid references public.organizations(id), user_id uuid references auth.users(id),
  role text not null, status text not null default 'active', primary key(organization_id,user_id)
);
create function private.is_org_member(org_id uuid, allowed_roles text[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members
    where organization_id = org_id and user_id = (select auth.uid())
      and status = 'active' and (allowed_roles is null or role = any(allowed_roles)));
$$;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
insert into auth.users(id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
insert into public.organizations values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002');
insert into public.stores(id,organization_id,name) values
  ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','A'),
  ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','B');
insert into public.organization_members(organization_id,user_id,role) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','editor'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','owner');
