alter table public.catalog_contents
  add column position integer not null default 0 check (position >= 0),
  add column content_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content_metadata) = 'object');

drop index public.catalog_contents_unique_context_idx;
create unique index catalog_contents_single_context_idx
  on public.catalog_contents (
    organization_id, catalog_item_id, variant_id, channel_id, locale, content_type
  ) nulls not distinct
  where content_type not in ('feature','benefit');
create unique index catalog_contents_repeatable_context_idx
  on public.catalog_contents (
    organization_id, catalog_item_id, variant_id, channel_id, locale, content_type, position
  ) nulls not distinct
  where content_type in ('feature','benefit');

create table public.catalog_item_compositions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  catalog_item_id uuid not null,
  variant_id uuid,
  component_name text not null,
  component_type text not null check (component_type in ('material','part','ingredient','assembly')),
  material_code text,
  percentage numeric(7,4) check (percentage is null or percentage between 0 and 100),
  quantity numeric(18,6) check (quantity is null or quantity >= 0),
  quantity_unit text,
  supplier_name text,
  origin_country text,
  is_primary boolean not null default false,
  notes text,
  source_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_item_compositions_item_organization_fkey
    foreign key (catalog_item_id, organization_id)
    references public.catalog_items (id, organization_id) on delete cascade,
  constraint catalog_item_compositions_variant_item_organization_fkey
    foreign key (variant_id, catalog_item_id, organization_id)
    references public.catalog_variants (id, catalog_item_id, organization_id) on delete cascade,
  constraint catalog_item_compositions_source_organization_fkey
    foreign key (source_id, organization_id)
    references public.catalog_sources (id, organization_id) on delete set null (source_id)
);

create index catalog_item_compositions_item_idx
  on public.catalog_item_compositions (organization_id, catalog_item_id, is_primary desc, created_at);
create index catalog_item_compositions_variant_fk_idx
  on public.catalog_item_compositions (variant_id, catalog_item_id, organization_id)
  where variant_id is not null;
create index catalog_item_compositions_source_fk_idx
  on public.catalog_item_compositions (source_id, organization_id)
  where source_id is not null;
create index catalog_item_compositions_created_by_idx
  on public.catalog_item_compositions (created_by)
  where created_by is not null;

alter table public.catalog_item_compositions enable row level security;
grant select, insert, update, delete on public.catalog_item_compositions to authenticated;
create policy catalog_item_compositions_member_select
  on public.catalog_item_compositions for select to authenticated
  using (private.is_org_member(organization_id));
create policy catalog_item_compositions_editor_insert
  on public.catalog_item_compositions for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_item_compositions_editor_update
  on public.catalog_item_compositions for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_item_compositions_editor_delete
  on public.catalog_item_compositions for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));
