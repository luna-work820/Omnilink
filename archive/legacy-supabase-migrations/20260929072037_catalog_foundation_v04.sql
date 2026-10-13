-- OmniLink catalog foundation v0.4
-- Scope: organizations, stores, catalog/SKU, attributes, and search projection.
-- This migration intentionally does not create AI vectors, scenes, orders, or suppliers.

create extension if not exists citext with schema extensions;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug extensions.citext not null unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  logo_url text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug extensions.citext not null,
  domain text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  currency char(3) not null default 'CNY',
  locale text not null default 'zh-CN',
  timezone text not null default 'Asia/Shanghai',
  brand_kit jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create unique index stores_domain_unique_idx on public.stores (domain) where domain is not null;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  slug extensions.citext,
  subtitle text,
  description text,
  product_type text not null default 'physical',
  status text not null default 'draft' check (status in ('draft', 'processing', 'ready', 'active', 'archived')),
  brand text,
  category_path text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  source_type text check (source_type in ('manual', 'ai', 'imported', 'external')),
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (store_id, slug)
);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  code text not null,
  position integer not null default 0,
  is_variant_dimension boolean not null default true,
  unique (product_id, code)
);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  option_id uuid not null references public.product_options(id) on delete cascade,
  value text not null,
  label text not null,
  code text,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  unique (option_id, value)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null,
  title text,
  barcode text,
  price_cents integer not null default 0 check (price_cents >= 0),
  compare_at_price_cents integer check (compare_at_price_cents is null or compare_at_price_cents >= 0),
  currency char(3) not null default 'CNY',
  inventory_quantity integer not null default 0,
  manage_inventory boolean not null default true,
  allow_backorder boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  dimensions jsonb not null default '{}'::jsonb,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, sku)
);

create table public.product_variant_option_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  option_id uuid not null references public.product_options(id) on delete cascade,
  option_value_id uuid not null references public.product_option_values(id) on delete cascade,
  unique (variant_id, option_id),
  unique (variant_id, option_value_id)
);

create table public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  namespace text not null,
  key text not null,
  name text not null,
  value_type text not null check (value_type in ('text', 'number', 'boolean', 'json', 'enum')),
  unit text,
  enum_values jsonb,
  is_filterable boolean not null default true,
  is_searchable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, namespace, key)
);

create table public.product_attribute_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  attribute_definition_id uuid not null references public.attribute_definitions(id) on delete cascade,
  value jsonb not null,
  source text not null default 'manual' check (source in ('manual', 'ai', 'external', 'import')),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_search_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  projection_version integer not null default 1,
  generated_at timestamptz not null default now(),
  unique (product_id)
);

create index products_catalog_idx on public.products (organization_id, store_id, status, created_at desc);
create index product_options_product_idx on public.product_options (product_id, position);
create index product_option_values_option_idx on public.product_option_values (option_id, position);
create index product_variants_product_idx on public.product_variants (product_id, status);
create index product_variant_option_values_variant_idx on public.product_variant_option_values (variant_id, option_id);
create index product_attributes_product_idx on public.product_attribute_values (product_id, attribute_definition_id);
create index product_attributes_variant_idx on public.product_attribute_values (variant_id);
create index product_attributes_value_gin_idx on public.product_attribute_values using gin (value jsonb_path_ops);
create index product_search_documents_attributes_gin_idx on public.product_search_documents using gin (attributes jsonb_path_ops);

create or replace function public.refresh_product_search_document(p_product_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_org_id uuid;
  v_attributes jsonb;
begin
  select organization_id into v_org_id from public.products where id = p_product_id;
  if v_org_id is null then
    return;
  end if;

  select coalesce(jsonb_object_agg(attribute_key, values), '{}'::jsonb)
    into v_attributes
  from (
    select
      ad.namespace || '.' || ad.key as attribute_key,
      jsonb_agg(pav.value order by pav.id) as values
    from public.product_attribute_values pav
    join public.attribute_definitions ad on ad.id = pav.attribute_definition_id
    where pav.product_id = p_product_id
      and ad.is_searchable = true
    group by ad.namespace, ad.key
  ) grouped;

  insert into public.product_search_documents (organization_id, product_id, attributes, generated_at)
  values (v_org_id, p_product_id, v_attributes, now())
  on conflict (product_id) do update set
    attributes = excluded.attributes,
    projection_version = public.product_search_documents.projection_version + 1,
    generated_at = excluded.generated_at,
    organization_id = excluded.organization_id;
end;
$$;

create or replace function public.product_attribute_values_projection_trigger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.refresh_product_search_document(coalesce(new.product_id, old.product_id));
  return coalesce(new, old);
end;
$$;

create trigger product_attribute_values_projection_after_change
after insert or update or delete on public.product_attribute_values
for each row execute function public.product_attribute_values_projection_trigger();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'organization_members', 'stores', 'products',
    'attribute_definitions', 'product_attribute_values', 'product_search_documents'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_' || t || '_updated_at', t);
  end loop;
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_variant_option_values enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.product_attribute_values enable row level security;
alter table public.product_search_documents enable row level security;

create policy organizations_member_select on public.organizations
for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = organizations.id and m.user_id = (select auth.uid()) and m.status = 'active'));

create policy organizations_owner_update on public.organizations
for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy organization_members_same_org_select on public.organization_members
for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = organization_members.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'));

create policy organization_members_admin_write on public.organization_members
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = organization_members.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin')))
with check (exists (select 1 from public.organization_members m where m.organization_id = organization_members.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin')));

create policy stores_member_access on public.stores
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = stores.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = stores.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy products_member_access on public.products
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = products.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = products.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy product_options_member_access on public.product_options
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = product_options.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = product_options.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy product_option_values_member_access on public.product_option_values
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = product_option_values.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = product_option_values.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy product_variants_member_access on public.product_variants
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = product_variants.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = product_variants.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy product_variant_option_values_member_access on public.product_variant_option_values
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = product_variant_option_values.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = product_variant_option_values.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy attribute_definitions_member_read on public.attribute_definitions
for select to authenticated
using (organization_id is null or exists (select 1 from public.organization_members m where m.organization_id = attribute_definitions.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'));

create policy attribute_definitions_member_write on public.attribute_definitions
for all to authenticated
using (organization_id is not null and exists (select 1 from public.organization_members m where m.organization_id = attribute_definitions.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')))
with check (organization_id is not null and exists (select 1 from public.organization_members m where m.organization_id = attribute_definitions.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy product_attribute_values_member_access on public.product_attribute_values
for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = product_attribute_values.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'))
with check (exists (select 1 from public.organization_members m where m.organization_id = product_attribute_values.organization_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role in ('owner', 'admin', 'editor')));

create policy product_search_documents_member_read on public.product_search_documents
for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = product_search_documents.organization_id and m.user_id = (select auth.uid()) and m.status = 'active'));

grant select, insert, update, delete on all tables in schema public to authenticated;
