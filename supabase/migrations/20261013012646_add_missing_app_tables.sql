-- Missing application tables referenced by the active frontend/API code.
-- This migration is intentionally additive and has not been applied remotely.

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  theme_config jsonb not null default '{}'::jsonb,
  seo_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id)
);

create table if not exists public.templates (
  id text primary key,
  name text not null,
  author_id uuid references auth.users(id) on delete set null,
  -- Kept as text because existing preset identifiers are semantic strings
  -- (for example, "clean-light"), not UUID-backed industry rows.
  industry_id text,
  layout_config jsonb not null default '{}'::jsonb,
  preview_url text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_pages (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_id text references public.templates(id) on delete set null,
  sections jsonb not null default '[]'::jsonb,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id)
);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  file_url text,
  status text not null default 'pending',
  total_rows integer check (total_rows is null or total_rows >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  import_id uuid references public.imports(id) on delete set null,
  job_type text not null,
  status text not null default 'pending',
  model text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_plugins (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  plugin_name text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, plugin_name)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  order_number text not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  customer_whatsapp text,
  company text,
  country text,
  state text,
  city text,
  address text,
  notes text,
  contact_preference text not null default 'email',
  currency char(3) not null default 'USD',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  status text not null default 'inquiry_pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, order_number)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.catalog_items(id) on delete set null,
  variant_id uuid references public.catalog_variants(id) on delete set null,
  product_name_snapshot text not null,
  sku_snapshot text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_snapshot numeric(14,2) not null default 0 check (unit_price_snapshot >= 0),
  currency char(3) not null default 'USD',
  selected_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists store_settings_store_idx on public.store_settings (store_id);
create index if not exists store_pages_store_published_idx on public.store_pages (store_id, published);
create index if not exists imports_store_created_idx on public.imports (store_id, created_at desc);
create index if not exists ai_jobs_store_created_idx on public.ai_jobs (store_id, created_at desc);
create index if not exists ai_jobs_import_idx on public.ai_jobs (import_id);
create index if not exists store_plugins_store_idx on public.store_plugins (store_id, enabled);
create index if not exists orders_store_created_idx on public.orders (store_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.store_settings enable row level security;
alter table public.templates enable row level security;
alter table public.store_pages enable row level security;
alter table public.imports enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.store_plugins enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Public template discovery is required by the storefront template selector.
drop policy if exists templates_public_select on public.templates;
create policy templates_public_select on public.templates
  for select to anon, authenticated using (status = 'active');

drop policy if exists templates_editor_write on public.templates;
create policy templates_editor_write on public.templates
  for all to authenticated
  using (
    author_id = (select auth.uid())
    or author_id is null
  )
  with check (
    author_id = (select auth.uid())
    or author_id is null
  );

-- Store-owned resources resolve membership through stores.organization_id.
drop policy if exists store_settings_member_select on public.store_settings;
create policy store_settings_member_select on public.store_settings
  for select to authenticated using (
    exists (
      select 1 from public.stores s
      where s.id = store_settings.store_id
        and private.is_org_member(s.organization_id)
    )
  );

drop policy if exists store_settings_editor_write on public.store_settings;
create policy store_settings_editor_write on public.store_settings
  for all to authenticated using (
    exists (
      select 1 from public.stores s
      where s.id = store_settings.store_id
        and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
    )
  ) with check (
    exists (
      select 1 from public.stores s
      where s.id = store_settings.store_id
        and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
    )
  );

drop policy if exists store_pages_public_select on public.store_pages;
create policy store_pages_public_select on public.store_pages
  for select to anon, authenticated using (published = true);

drop policy if exists store_pages_editor_write on public.store_pages;
create policy store_pages_editor_write on public.store_pages
  for all to authenticated using (
    exists (
      select 1 from public.stores s
      where s.id = store_pages.store_id
        and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
    )
  ) with check (
    exists (
      select 1 from public.stores s
      where s.id = store_pages.store_id
        and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
    )
  );

drop policy if exists imports_member_select on public.imports;
create policy imports_member_select on public.imports
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = imports.store_id and private.is_org_member(s.organization_id))
  );
drop policy if exists imports_editor_write on public.imports;
create policy imports_editor_write on public.imports
  for all to authenticated using (
    exists (select 1 from public.stores s where s.id = imports.store_id and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor']))
  ) with check (
    exists (select 1 from public.stores s where s.id = imports.store_id and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor']))
  );

drop policy if exists ai_jobs_member_select on public.ai_jobs;
create policy ai_jobs_member_select on public.ai_jobs
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = ai_jobs.store_id and private.is_org_member(s.organization_id))
  );
drop policy if exists ai_jobs_editor_write on public.ai_jobs;
create policy ai_jobs_editor_write on public.ai_jobs
  for all to authenticated using (
    exists (select 1 from public.stores s where s.id = ai_jobs.store_id and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor']))
  ) with check (
    exists (select 1 from public.stores s where s.id = ai_jobs.store_id and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor']))
  );

drop policy if exists store_plugins_member_select on public.store_plugins;
create policy store_plugins_member_select on public.store_plugins
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = store_plugins.store_id and private.is_org_member(s.organization_id))
  );
drop policy if exists store_plugins_admin_write on public.store_plugins;
create policy store_plugins_admin_write on public.store_plugins
  for all to authenticated using (
    exists (select 1 from public.stores s where s.id = store_plugins.store_id and private.is_org_member(s.organization_id, array['owner', 'admin']))
  ) with check (
    exists (select 1 from public.stores s where s.id = store_plugins.store_id and private.is_org_member(s.organization_id, array['owner', 'admin']))
  );

-- Public checkout can create an order, but order data is only readable by the
-- owning organization. This avoids exposing customer PII through anon reads.
drop policy if exists orders_public_insert on public.orders;
create policy orders_public_insert on public.orders
  for insert to anon, authenticated with check (
    exists (select 1 from public.stores s where s.id = orders.store_id)
  );
drop policy if exists orders_member_select on public.orders;
create policy orders_member_select on public.orders
  for select to authenticated using (
    exists (select 1 from public.stores s where s.id = orders.store_id and private.is_org_member(s.organization_id))
  );
drop policy if exists orders_editor_write on public.orders;
create policy orders_editor_write on public.orders
  for update to authenticated using (
    exists (select 1 from public.stores s where s.id = orders.store_id and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor']))
  ) with check (
    exists (select 1 from public.stores s where s.id = orders.store_id and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor']))
  );

drop policy if exists order_items_public_insert on public.order_items;
create policy order_items_public_insert on public.order_items
  for insert to anon, authenticated with check (
    exists (select 1 from public.orders o where o.id = order_items.order_id)
  );
drop policy if exists order_items_member_select on public.order_items;
create policy order_items_member_select on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      join public.stores s on s.id = o.store_id
      where o.id = order_items.order_id
        and private.is_org_member(s.organization_id)
    )
  );
