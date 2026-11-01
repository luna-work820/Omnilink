-- Restore the non-order database resources used by the active application.

create table if not exists public.industries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

alter table public.industries enable row level security;
revoke all on public.industries from public, anon, authenticated;
grant select on public.industries to anon, authenticated;
drop policy if exists industries_public_select on public.industries;
create policy industries_public_select on public.industries
  for select to anon, authenticated using (true);

insert into public.industries (name, slug, description)
values
  ('Eyewear', 'eyewear', 'Glasses, sunglasses, and optical accessories'),
  ('Fashion', 'fashion', 'Clothing, apparel, and fashion accessories'),
  ('Jewelry', 'jewelry', 'Fine jewelry, watches, and accessories'),
  ('Electronics', 'electronics', 'Consumer electronics and gadgets'),
  ('Home & Garden', 'home-garden', 'Home decor, furniture, and garden supplies'),
  ('Sports', 'sports', 'Sports equipment and athletic wear'),
  ('Beauty', 'beauty', 'Cosmetics, skincare, and personal care'),
  ('Food & Beverage', 'food-beverage', 'Food products and beverages')
on conflict (slug) do nothing;

-- The analytics endpoint reads these events. No event producer exists yet;
-- only trusted server code may write them when collection is implemented.
create table if not exists public.semantic_query_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  query_text text not null,
  parsed_intent text,
  matched_product_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(matched_product_ids) = 'array'),
  matched_concepts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(matched_concepts) = 'array'),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  source text not null default 'agent_api',
  created_at timestamptz not null default now()
);

create index if not exists semantic_query_events_org_created_idx
  on public.semantic_query_events (organization_id, created_at desc);
create index if not exists semantic_query_events_product_ids_idx
  on public.semantic_query_events using gin (matched_product_ids);

alter table public.semantic_query_events enable row level security;
revoke all on public.semantic_query_events from public, anon, authenticated;
grant select on public.semantic_query_events to authenticated;
drop policy if exists semantic_query_events_member_select on public.semantic_query_events;
create policy semantic_query_events_member_select on public.semantic_query_events
  for select to authenticated
  using (private.is_org_member(organization_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('omnilink-media-originals', 'omnilink-media-originals', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('omnilink-media-public', 'omnilink-media-public', true, 10485760,
   array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The upload route stores productId/assetId/file. All mutations require
-- editor membership in the product's organization, including upsert cleanup.
drop policy if exists omnilink_media_editor_insert on storage.objects;
create policy omnilink_media_editor_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('omnilink-media-originals', 'omnilink-media-public')
    and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(name, '/', 4) = ''
    and (
      (bucket_id = 'omnilink-media-originals'
       and split_part(name, '/', 3) in ('original.jpg', 'original.png', 'original.webp'))
      or (bucket_id = 'omnilink-media-public'
          and split_part(name, '/', 3) = 'public.webp')
    )
    and exists (
      select 1 from public.catalog_items ci
      where ci.id::text = split_part(name, '/', 1)
        and private.is_org_member(ci.organization_id, array['owner', 'admin', 'editor'])
    )
  );

drop policy if exists omnilink_media_editor_select on storage.objects;
create policy omnilink_media_editor_select on storage.objects
  for select to authenticated
  using (
    bucket_id in ('omnilink-media-originals', 'omnilink-media-public')
    and exists (
      select 1 from public.catalog_items ci
      where ci.id::text = split_part(name, '/', 1)
        and private.is_org_member(ci.organization_id, array['owner', 'admin', 'editor'])
    )
  );

drop policy if exists omnilink_media_editor_update on storage.objects;
create policy omnilink_media_editor_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('omnilink-media-originals', 'omnilink-media-public')
    and exists (
      select 1 from public.catalog_items ci
      where ci.id::text = split_part(name, '/', 1)
        and private.is_org_member(ci.organization_id, array['owner', 'admin', 'editor'])
    )
  )
  with check (
    bucket_id in ('omnilink-media-originals', 'omnilink-media-public')
    and exists (
      select 1 from public.catalog_items ci
      where ci.id::text = split_part(name, '/', 1)
        and private.is_org_member(ci.organization_id, array['owner', 'admin', 'editor'])
    )
  );

drop policy if exists omnilink_media_editor_delete on storage.objects;
create policy omnilink_media_editor_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('omnilink-media-originals', 'omnilink-media-public')
    and exists (
      select 1 from public.catalog_items ci
      where ci.id::text = split_part(name, '/', 1)
        and private.is_org_member(ci.organization_id, array['owner', 'admin', 'editor'])
    )
  );

create index if not exists catalog_item_channels_store_org_fk_idx
  on public.catalog_item_channels (store_id, organization_id);
create index if not exists store_pages_template_fk_idx
  on public.store_pages (template_id);
create index if not exists templates_author_fk_idx
  on public.templates (author_id);
