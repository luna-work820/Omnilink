begin;

alter table public.consumer_catalog_products
  add column added_at timestamptz not null default now();

comment on column public.consumer_catalog_products.added_at is
  'Time the product first entered the catalog; retained during refreshes.';

create index consumer_catalog_products_published_added_at_idx
  on public.consumer_catalog_products (added_at desc, id asc)
  where published;

grant select (added_at) on public.consumer_catalog_products to anon, authenticated;

commit;
