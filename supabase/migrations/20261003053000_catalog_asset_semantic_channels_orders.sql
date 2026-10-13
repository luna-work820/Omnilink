-- OmniLink catalog asset MVP v1.
-- Scope: multi-channel catalog, text/image semantic retrieval, and demo checkout.
-- This migration is additive: it does not alter or delete the existing products domain.

create extension if not exists vector with schema extensions;

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null check (item_type in ('product', 'service', 'skill')),
  title text not null,
  slug text,
  description text,
  cover_image text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.catalog_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  sku_code text,
  title text not null,
  price numeric(14,2) not null default 0 check (price >= 0),
  currency_code char(3) not null default 'CNY',
  availability_type text not null default 'stock'
    check (availability_type in ('stock', 'capacity', 'appointment', 'unlimited')),
  availability_value numeric(14,2) check (availability_value is null or availability_value >= 0),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku_code)
);

create table public.catalog_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  variant_id uuid references public.catalog_variants(id) on delete set null,
  media_type text not null check (media_type in ('image', 'video', 'document')),
  media_role text not null check (media_role in ('cover', 'detail', 'variant', 'style_reference', 'generated', 'user_uploaded')),
  storage_path text not null,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.sales_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  channel_type text not null check (channel_type in ('workspace', 'storefront', 'marketplace', 'social')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.catalog_item_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  channel_id uuid not null references public.sales_channels(id) on delete cascade,
  is_visible boolean not null default false,
  is_purchasable boolean not null default false,
  price_override numeric(14,2) check (price_override is null or price_override >= 0),
  currency_code char(3),
  published_at timestamptz,
  unique (catalog_item_id, channel_id)
);

create table public.semantic_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('catalog_item', 'catalog_variant', 'catalog_media')),
  entity_id uuid not null,
  content text not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_type, entity_id, content_hash)
);

create table public.semantic_embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.semantic_documents(id) on delete cascade,
  modality text not null check (modality in ('text', 'image', 'multimodal')),
  provider text not null default 'qwen',
  model text not null default 'Qwen3-Embedding',
  dimensions integer not null default 1024 check (dimensions = 1024),
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  unique (document_id, modality, model)
);

create table public.demo_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_id uuid references public.sales_channels(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  currency_code char(3) not null default 'CNY',
  created_at timestamptz not null default now()
);

create table public.demo_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.demo_orders(id) on delete cascade,
  catalog_item_id uuid not null references public.catalog_items(id) on delete restrict,
  variant_id uuid not null references public.catalog_variants(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index catalog_items_org_status_idx on public.catalog_items (organization_id, status, created_at desc);
create index catalog_variants_item_idx on public.catalog_variants (catalog_item_id, created_at);
create index catalog_media_item_idx on public.catalog_media (catalog_item_id, media_role, created_at);
create index sales_channels_org_status_idx on public.sales_channels (organization_id, status);
create index catalog_item_channels_channel_idx on public.catalog_item_channels (channel_id, is_visible, is_purchasable);
create index semantic_documents_entity_idx on public.semantic_documents (organization_id, entity_type, entity_id);
create index semantic_embeddings_document_idx on public.semantic_embeddings (organization_id, document_id, modality);
create index semantic_embeddings_hnsw_idx on public.semantic_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);
create index demo_orders_org_created_idx on public.demo_orders (organization_id, created_at desc);
create index demo_order_items_order_idx on public.demo_order_items (order_id);

alter table public.catalog_items enable row level security;
alter table public.catalog_variants enable row level security;
alter table public.catalog_media enable row level security;
alter table public.sales_channels enable row level security;
alter table public.catalog_item_channels enable row level security;
alter table public.semantic_documents enable row level security;
alter table public.semantic_embeddings enable row level security;
alter table public.demo_orders enable row level security;
alter table public.demo_order_items enable row level security;

create policy catalog_items_member_select on public.catalog_items
  for select to authenticated using (private.is_org_member(organization_id));
create policy catalog_items_editor_write on public.catalog_items
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy catalog_variants_member_select on public.catalog_variants
  for select to authenticated using (private.is_org_member(organization_id));
create policy catalog_variants_editor_write on public.catalog_variants
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy catalog_media_member_select on public.catalog_media
  for select to authenticated using (private.is_org_member(organization_id));
create policy catalog_media_editor_write on public.catalog_media
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy sales_channels_member_select on public.sales_channels
  for select to authenticated using (private.is_org_member(organization_id));
create policy sales_channels_admin_write on public.sales_channels
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin']))
  with check (private.is_org_member(organization_id, array['owner', 'admin']));

create policy catalog_item_channels_member_select on public.catalog_item_channels
  for select to authenticated using (private.is_org_member(organization_id));
create policy catalog_item_channels_editor_write on public.catalog_item_channels
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy semantic_documents_member_select on public.semantic_documents
  for select to authenticated using (private.is_org_member(organization_id));
create policy semantic_documents_editor_write on public.semantic_documents
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy semantic_embeddings_member_select on public.semantic_embeddings
  for select to authenticated using (private.is_org_member(organization_id));
create policy semantic_embeddings_editor_write on public.semantic_embeddings
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy demo_orders_member_select on public.demo_orders
  for select to authenticated using (private.is_org_member(organization_id));
create policy demo_orders_editor_write on public.demo_orders
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy demo_order_items_member_select on public.demo_order_items
  for select to authenticated using (private.is_org_member(organization_id));
create policy demo_order_items_editor_write on public.demo_order_items
  for all to authenticated using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));
