alter table public.stores add column status text not null default 'active', add column deleted_at timestamptz;
update public.stores set slug=lower(name);
create table public.catalog_categories(id uuid primary key,organization_id uuid,name text);
create table public.catalog_items(
  id uuid primary key,organization_id uuid not null,item_type text not null default 'product',title text not null,
  description text,created_at timestamptz not null default now(),cover_image text,status text not null default 'active',
  category_id uuid,details jsonb not null default '{}'
);
create table public.sales_channels(id uuid primary key,organization_id uuid,code text,channel_type text,status text);
create table public.catalog_item_channels(
  id uuid primary key default gen_random_uuid(),organization_id uuid,catalog_item_id uuid references public.catalog_items(id) on delete cascade,
  channel_id uuid references public.sales_channels(id),store_id uuid references public.stores(id),is_visible boolean not null default true
);
create table public.catalog_variants(
  id uuid primary key default gen_random_uuid(),organization_id uuid,catalog_item_id uuid references public.catalog_items(id) on delete cascade,
  price numeric(14,2),currency_code char(3),created_at timestamptz not null default now()
);
create table public.catalog_media(
  id uuid primary key default gen_random_uuid(),organization_id uuid,catalog_item_id uuid references public.catalog_items(id) on delete cascade,
  media_type text,media_role text,storage_path text,created_at timestamptz not null default now()
);
grant select on public.catalog_items,public.catalog_categories,public.catalog_item_channels,public.sales_channels,
  public.catalog_variants,public.catalog_media,public.stores to service_role;
create view public.discovery_products as
select i.id,i.title,i.description,i.created_at,s.name as publisher_name,s.slug as publisher_slug,i.cover_image,
  v.price,v.currency_code,'amount'::text as price_mode,null::text as xiaohongshu_url,null::text as douyin_url
from public.catalog_items i join public.catalog_item_channels c on c.catalog_item_id=i.id
join public.stores s on s.id=c.store_id left join public.catalog_variants v on v.catalog_item_id=i.id;
insert into public.sales_channels values
('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','storefront','storefront','active'),
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','storefront','storefront','active');
