-- Catalog PIM, source-grounded AI review, and versioned storefront generation.
-- The existing catalog_items/catalog_variants tables remain the single
-- product and SKU identity. This migration adds normalized domains around it.

-- Composite keys make tenant ownership enforceable across relationships.
alter table public.stores
  add constraint stores_id_organization_key unique (id, organization_id);

alter table public.catalog_variants
  add constraint catalog_variants_id_item_organization_key
  unique (id, catalog_item_id, organization_id);

-- UnoPim-style taxonomy and attribute definitions.
create table public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid,
  code text not null,
  name text not null,
  description text,
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, code),
  constraint catalog_categories_parent_organization_fkey
    foreign key (parent_id, organization_id)
    references public.catalog_categories (id, organization_id) on delete restrict,
  constraint catalog_categories_not_self_parent check (parent_id is null or parent_id <> id)
);

alter table public.catalog_items add column category_id uuid;
alter table public.catalog_items
  add constraint catalog_items_category_organization_fkey
  foreign key (category_id, organization_id)
  references public.catalog_categories (id, organization_id) on delete restrict;

create table public.catalog_attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid,
  code text not null,
  label text not null,
  value_type text not null check (value_type in ('text', 'number', 'boolean', 'date', 'url', 'enum', 'json')),
  unit text,
  is_required boolean not null default false,
  is_filterable boolean not null default false,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint catalog_attribute_definitions_category_organization_fkey
    foreign key (category_id, organization_id)
    references public.catalog_categories (id, organization_id) on delete restrict
);

create unique index catalog_attribute_definitions_org_global_code_idx
  on public.catalog_attribute_definitions (organization_id, code)
  where category_id is null;
create unique index catalog_attribute_definitions_org_category_code_idx
  on public.catalog_attribute_definitions (organization_id, category_id, code)
  where category_id is not null;

-- Shared source records for uploads, URLs, spreadsheets, and manual facts.
create table public.catalog_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid,
  source_type text not null check (source_type in (
    'merchant_answer', 'document', 'image', 'spreadsheet', 'website',
    'url', 'pasted_text', 'database_record', 'external_registry', 'other'
  )),
  title text,
  uri text,
  storage_path text,
  content_hash text,
  captured_at timestamptz,
  ingest_status text not null default 'pending'
    check (ingest_status in ('pending', 'processing', 'processed', 'failed', 'rejected')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  constraint catalog_sources_store_organization_fkey
    foreign key (store_id, organization_id)
    references public.stores (id, organization_id) on delete cascade
);

create unique index catalog_sources_store_hash_idx
  on public.catalog_sources (store_id, content_hash)
  where store_id is not null and content_hash is not null;

create table public.catalog_item_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  catalog_item_id uuid not null,
  source_id uuid not null,
  relation_role text not null default 'supports'
    check (relation_role in ('supports', 'depicts', 'derived_from', 'contradicts')),
  locator text,
  excerpt text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (catalog_item_id, source_id, relation_role),
  constraint catalog_item_sources_item_organization_fkey
    foreign key (catalog_item_id, organization_id)
    references public.catalog_items (id, organization_id) on delete cascade,
  constraint catalog_item_sources_source_organization_fkey
    foreign key (source_id, organization_id)
    references public.catalog_sources (id, organization_id) on delete cascade
);

create table public.catalog_item_attributes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  catalog_item_id uuid not null,
  variant_id uuid,
  definition_id uuid not null,
  value jsonb not null,
  source_id uuid,
  value_origin text not null default 'manual'
    check (value_origin in ('manual', 'import', 'ai', 'system')),
  confidence numeric(4,3) check (confidence is null or confidence between 0 and 1),
  review_status text not null default 'confirmed'
    check (review_status in ('pending_review', 'confirmed', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_item_attributes_item_organization_fkey
    foreign key (catalog_item_id, organization_id)
    references public.catalog_items (id, organization_id) on delete cascade,
  constraint catalog_item_attributes_variant_item_organization_fkey
    foreign key (variant_id, catalog_item_id, organization_id)
    references public.catalog_variants (id, catalog_item_id, organization_id) on delete cascade,
  constraint catalog_item_attributes_definition_organization_fkey
    foreign key (definition_id, organization_id)
    references public.catalog_attribute_definitions (id, organization_id) on delete restrict,
  constraint catalog_item_attributes_source_organization_fkey
    foreign key (source_id, organization_id)
    references public.catalog_sources (id, organization_id) on delete set null (source_id)
);

create unique index catalog_item_attributes_item_code_idx
  on public.catalog_item_attributes (organization_id, catalog_item_id, definition_id)
  where variant_id is null;
create unique index catalog_item_attributes_variant_code_idx
  on public.catalog_item_attributes (organization_id, catalog_item_id, variant_id, definition_id)
  where variant_id is not null;

-- Canonical, localized product content; storefronts consume approved records.
create table public.catalog_contents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  catalog_item_id uuid not null,
  variant_id uuid,
  channel_id uuid,
  locale text not null default 'zh-CN',
  content_type text not null check (content_type in (
    'name', 'short_description', 'description', 'feature', 'benefit',
    'usage', 'care', 'seo_title', 'seo_description', 'seo_keywords'
  )),
  title text,
  body text,
  keywords text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'published', 'rejected', 'archived')),
  source_id uuid,
  generation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(generation_metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_contents_item_organization_fkey
    foreign key (catalog_item_id, organization_id)
    references public.catalog_items (id, organization_id) on delete cascade,
  constraint catalog_contents_variant_item_organization_fkey
    foreign key (variant_id, catalog_item_id, organization_id)
    references public.catalog_variants (id, catalog_item_id, organization_id) on delete cascade,
  constraint catalog_contents_channel_organization_fkey
    foreign key (channel_id, organization_id)
    references public.sales_channels (id, organization_id) on delete cascade,
  constraint catalog_contents_source_organization_fkey
    foreign key (source_id, organization_id)
    references public.catalog_sources (id, organization_id) on delete set null (source_id)
);

create unique index catalog_contents_unique_context_idx
  on public.catalog_contents (organization_id, catalog_item_id, variant_id, channel_id, locale, content_type)
  nulls not distinct;

-- Pimcore-style typed relations between catalog identities.
create table public.catalog_item_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_item_id uuid not null,
  target_item_id uuid not null,
  relation_type text not null check (relation_type in (
    'complements', 'accessory_for', 'replacement_for', 'part_of', 'same_series', 'related'
  )),
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (source_item_id, target_item_id, relation_type),
  constraint catalog_item_relations_source_organization_fkey
    foreign key (source_item_id, organization_id)
    references public.catalog_items (id, organization_id) on delete cascade,
  constraint catalog_item_relations_target_organization_fkey
    foreign key (target_item_id, organization_id)
    references public.catalog_items (id, organization_id) on delete cascade,
  constraint catalog_item_relations_not_self check (source_item_id <> target_item_id)
);

-- AI writes proposed changes first; application code applies approved patches
-- to Catalog in a transaction and records the resulting status here.
create table public.catalog_item_change_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  catalog_item_id uuid not null,
  source_id uuid,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'applied', 'failed')),
  change_set jsonb not null check (jsonb_typeof(change_set) = 'array'),
  generation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(generation_metadata) = 'object'),
  error_message text,
  proposed_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint catalog_item_change_sets_item_organization_fkey
    foreign key (catalog_item_id, organization_id)
    references public.catalog_items (id, organization_id) on delete cascade,
  constraint catalog_item_change_sets_source_organization_fkey
    foreign key (source_id, organization_id)
    references public.catalog_sources (id, organization_id) on delete set null (source_id)
);

-- Keep a history of the Brand Runtime document already stored on merchant_profiles.
alter table public.merchant_profile_sources
  add constraint merchant_profile_sources_id_profile_key unique (id, profile_id);

create table public.merchant_profile_revisions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.merchant_profiles(id) on delete cascade,
  revision integer not null check (revision > 0),
  profile_document jsonb not null check (jsonb_typeof(profile_document) = 'object'),
  source_id uuid,
  change_summary text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, revision),
  constraint merchant_profile_revisions_source_profile_fkey
    foreign key (source_id, profile_id)
    references public.merchant_profile_sources (id, profile_id) on delete set null (source_id)
);

-- A generated site is versioned data, not generated HTML or mutable page rows.
create table public.storefronts (
  store_id uuid primary key,
  organization_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused')),
  custom_domain text,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  draft_version_id uuid,
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, organization_id),
  constraint storefronts_store_organization_fkey
    foreign key (store_id, organization_id)
    references public.stores (id, organization_id) on delete cascade
);

create unique index storefronts_custom_domain_idx
  on public.storefronts (lower(custom_domain)) where custom_domain is not null;

create table public.storefront_versions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  organization_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'published', 'superseded', 'rejected')),
  schema_document jsonb not null check (jsonb_typeof(schema_document) = 'object'),
  generation_brief jsonb not null default '{}'::jsonb
    check (jsonb_typeof(generation_brief) = 'object'),
  source_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_snapshot) = 'object'),
  generation_model text,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (store_id, version_number),
  unique (id, store_id, organization_id),
  constraint storefront_versions_store_organization_fkey
    foreign key (store_id, organization_id)
    references public.stores (id, organization_id) on delete cascade
);

alter table public.storefronts
  add constraint storefronts_draft_version_store_fkey
  foreign key (draft_version_id, store_id, organization_id)
  references public.storefront_versions (id, store_id, organization_id) on delete restrict,
  add constraint storefronts_published_version_store_fkey
  foreign key (published_version_id, store_id, organization_id)
  references public.storefront_versions (id, store_id, organization_id) on delete restrict;

create index catalog_categories_org_parent_position_idx
  on public.catalog_categories (organization_id, parent_id, position);
create index catalog_items_org_category_status_idx
  on public.catalog_items (organization_id, category_id, status, updated_at desc);
create index catalog_attribute_definitions_org_category_position_idx
  on public.catalog_attribute_definitions (organization_id, category_id, position);
create index catalog_attribute_definitions_category_organization_idx
  on public.catalog_attribute_definitions (category_id, organization_id)
  where category_id is not null;
create index catalog_sources_org_store_created_idx
  on public.catalog_sources (organization_id, store_id, created_at desc);
create index catalog_sources_store_organization_idx
  on public.catalog_sources (store_id, organization_id)
  where store_id is not null;
create index catalog_item_sources_org_item_idx
  on public.catalog_item_sources (organization_id, catalog_item_id, created_at desc);
create index catalog_item_sources_source_idx
  on public.catalog_item_sources (source_id);
create index catalog_item_attributes_org_item_idx
  on public.catalog_item_attributes (organization_id, catalog_item_id, definition_id);
create index catalog_item_attributes_org_variant_idx
  on public.catalog_item_attributes (organization_id, variant_id, definition_id)
  where variant_id is not null;
create index catalog_item_attributes_variant_item_org_idx
  on public.catalog_item_attributes (variant_id, catalog_item_id, organization_id)
  where variant_id is not null;
create index catalog_item_attributes_definition_org_idx
  on public.catalog_item_attributes (definition_id, organization_id);
create index catalog_item_attributes_source_org_idx
  on public.catalog_item_attributes (source_id, organization_id)
  where source_id is not null;
create index catalog_item_attributes_org_review_idx
  on public.catalog_item_attributes (organization_id, review_status, catalog_item_id);
create index catalog_contents_org_item_status_idx
  on public.catalog_contents (organization_id, catalog_item_id, status, locale);
create index catalog_contents_channel_status_idx
  on public.catalog_contents (organization_id, channel_id, status, locale)
  where channel_id is not null;
create index catalog_contents_channel_organization_idx
  on public.catalog_contents (channel_id, organization_id)
  where channel_id is not null;
create index catalog_contents_source_organization_idx
  on public.catalog_contents (source_id, organization_id)
  where source_id is not null;
create index catalog_contents_variant_item_org_idx
  on public.catalog_contents (variant_id, catalog_item_id, organization_id)
  where variant_id is not null;
create index catalog_contents_item_organization_idx
  on public.catalog_contents (catalog_item_id, organization_id);
create index catalog_item_relations_target_idx
  on public.catalog_item_relations (organization_id, target_item_id, relation_type);
create index catalog_item_relations_source_org_idx
  on public.catalog_item_relations (source_item_id, organization_id);
create index catalog_item_change_sets_review_idx
  on public.catalog_item_change_sets (organization_id, status, created_at desc);
create index catalog_item_change_sets_item_org_idx
  on public.catalog_item_change_sets (catalog_item_id, organization_id, created_at desc);
create index catalog_item_change_sets_source_org_idx
  on public.catalog_item_change_sets (source_id, organization_id)
  where source_id is not null;
create index merchant_profile_revisions_profile_created_idx
  on public.merchant_profile_revisions (profile_id, created_at desc);
create index merchant_profile_revisions_source_profile_idx
  on public.merchant_profile_revisions (source_id, profile_id)
  where source_id is not null;
create index storefront_versions_org_store_status_idx
  on public.storefront_versions (organization_id, store_id, status, version_number desc);

-- RLS: every new exposed public table is tenant scoped and editor writes are role gated.
do $$
declare
  target text;
begin
  foreach target in array array[
    'catalog_categories', 'catalog_attribute_definitions', 'catalog_sources',
    'catalog_item_sources', 'catalog_item_attributes', 'catalog_contents',
    'catalog_item_relations', 'catalog_item_change_sets', 'storefronts',
    'storefront_versions'
  ] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_org_member(organization_id))', target || '_member_select', target);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_org_member(organization_id, array[''owner'',''admin'',''editor'']))', target || '_editor_insert', target);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_org_member(organization_id, array[''owner'',''admin'',''editor''])) with check (private.is_org_member(organization_id, array[''owner'',''admin'',''editor'']))', target || '_editor_update', target);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_org_member(organization_id, array[''owner'',''admin'',''editor'']))', target || '_editor_delete', target);
  end loop;
end $$;

alter table public.merchant_profile_revisions enable row level security;
grant select, insert on public.merchant_profile_revisions to authenticated;
create policy merchant_profile_revisions_member_select on public.merchant_profile_revisions
  for select to authenticated using (exists (
    select 1 from public.merchant_profiles p join public.stores s on s.id = p.store_id
    where p.id = profile_id and private.is_org_member(s.organization_id)
  ));
create policy merchant_profile_revisions_editor_insert on public.merchant_profile_revisions
  for insert to authenticated with check (exists (
    select 1 from public.merchant_profiles p join public.stores s on s.id = p.store_id
    where p.id = profile_id and private.is_org_member(s.organization_id, array['owner','admin','editor'])
  ));
