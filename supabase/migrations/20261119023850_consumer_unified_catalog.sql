begin;

create table public.consumer_catalog_products (
  id text primary key check (char_length(id) between 1 and 100),
  canonical_url text not null unique check (canonical_url ~ '^https://'),
  product jsonb not null check (jsonb_typeof(product) = 'object' and product->>'id' = id and product->>'sourceUrl' = canonical_url),
  source_type text not null check (source_type in ('sample', 'firecrawl', 'apify')),
  captured_at timestamptz not null,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create index consumer_catalog_products_published_idx
  on public.consumer_catalog_products (id) where published;
alter table public.consumer_catalog_products enable row level security;
revoke all on public.consumer_catalog_products from public, anon, authenticated;
grant select (id, product, published) on public.consumer_catalog_products to anon, authenticated;
create policy consumer_catalog_published_read on public.consumer_catalog_products
  for select to anon, authenticated using (published);
grant select, insert, update on public.consumer_catalog_products to service_role;

create function public.upsert_consumer_catalog_product(
  p_url text, p_product jsonb, p_source_type text, p_captured_at timestamptz, p_publish boolean default false
) returns text
language plpgsql security invoker set search_path = '' as $$
declare result_id text;
begin
  if p_url !~ '^https://' or jsonb_typeof(p_product) <> 'object'
     or coalesce(p_product->>'id', '') = '' or p_product->>'sourceUrl' is distinct from p_url or p_captured_at is null then
    raise exception 'INVALID_CATALOG_PRODUCT' using errcode = '22023';
  end if;
  insert into public.consumer_catalog_products as existing
    (id, canonical_url, product, source_type, captured_at, published)
  values (p_product->>'id', p_url, p_product, p_source_type, p_captured_at, coalesce(p_publish, false))
  on conflict (canonical_url) do update set
    product = jsonb_set(excluded.product, '{id}', to_jsonb(existing.id)),
    source_type = excluded.source_type,
    captured_at = excluded.captured_at,
    published = existing.published or excluded.published,
    updated_at = now()
  where excluded.captured_at >= existing.captured_at
  returning id into result_id;
  if result_id is null then
    select id into result_id from public.consumer_catalog_products where canonical_url = p_url;
  end if;
  return result_id;
end;
$$;
revoke all on function public.upsert_consumer_catalog_product(text,jsonb,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.upsert_consumer_catalog_product(text,jsonb,text,timestamptz,boolean) to service_role;

alter table public.consumer_discovery_runs drop constraint if exists consumer_discovery_execution_shape;
alter table public.consumer_discovery_runs add constraint consumer_discovery_execution_shape
  check (execution is null or coalesce((char_length(execution->>'catalogVersion') between 1 and 100
    and jsonb_typeof(execution->'candidateKeys') = 'array'
    and jsonb_array_length(execution->'candidateKeys') <= 1000),false));

commit;
