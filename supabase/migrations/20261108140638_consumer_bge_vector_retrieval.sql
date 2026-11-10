-- Consumer-facing vector recall uses a separate 512-dimension local BGE index.
-- The merchant semantic index remains organization-scoped at 1024 dimensions.

create table public.consumer_catalog_embeddings (
  product_id uuid primary key references public.catalog_items(id) on delete cascade,
  embedding extensions.vector(512) not null,
  model text not null,
  content_hash text not null,
  indexed_at timestamptz not null default now()
);

create index consumer_catalog_embeddings_hnsw_idx
  on public.consumer_catalog_embeddings using hnsw (embedding extensions.vector_cosine_ops);

alter table public.consumer_catalog_embeddings enable row level security;
revoke all on public.consumer_catalog_embeddings from public, anon, authenticated;
grant select, insert, update, delete on public.consumer_catalog_embeddings to service_role;
grant select on public.discovery_products to service_role;

create table public.consumer_catalog_embedding_jobs (
  product_id uuid primary key,
  organization_id uuid not null,
  queued_at timestamptz not null default now(),
  locked_until timestamptz,
  attempts integer not null default 0,
  last_error text,
  foreign key (product_id, organization_id)
    references public.catalog_items(id, organization_id) on delete cascade
);

alter table public.consumer_catalog_embedding_jobs enable row level security;
revoke all on public.consumer_catalog_embedding_jobs from public, anon, authenticated;
grant insert, update on public.consumer_catalog_embedding_jobs to authenticated;
grant select, insert, update, delete on public.consumer_catalog_embedding_jobs to service_role;

create policy consumer_catalog_embedding_jobs_editor_enqueue
  on public.consumer_catalog_embedding_jobs for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));
create policy consumer_catalog_embedding_jobs_editor_refresh
  on public.consumer_catalog_embedding_jobs for update to authenticated
  using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
  with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

-- RLS checks that a caller can only enqueue items in an organization they edit.
create or replace function public.enqueue_consumer_catalog_embedding(p_product_id uuid, p_organization_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.consumer_catalog_embedding_jobs (product_id, organization_id, queued_at, locked_until, attempts, last_error)
  values (p_product_id, p_organization_id, pg_catalog.now(), null, 0, null)
  on conflict (product_id) do update
    set organization_id = excluded.organization_id,
        queued_at = excluded.queued_at,
        locked_until = null,
        attempts = 0,
        last_error = null;
$$;

grant execute on function public.enqueue_consumer_catalog_embedding(uuid, uuid) to authenticated, service_role;

create or replace function public.enqueue_consumer_catalog_item_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.enqueue_consumer_catalog_embedding(new.id, new.organization_id);
  return new;
end;
$$;

create or replace function public.enqueue_consumer_catalog_channel_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_consumer_catalog_embedding(old.catalog_item_id, old.organization_id);
    return old;
  end if;
  perform public.enqueue_consumer_catalog_embedding(new.catalog_item_id, new.organization_id);
  if tg_op = 'UPDATE' and old.catalog_item_id is distinct from new.catalog_item_id then
    perform public.enqueue_consumer_catalog_embedding(old.catalog_item_id, old.organization_id);
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_consumer_catalog_store_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.enqueue_consumer_catalog_embedding(catalog_item_id, organization_id)
  from public.catalog_item_channels
  where store_id = new.id;
  return new;
end;
$$;

create or replace function public.enqueue_consumer_catalog_sales_channel_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.enqueue_consumer_catalog_embedding(catalog_item_id, organization_id)
  from public.catalog_item_channels
  where channel_id = new.id;
  return new;
end;
$$;

create or replace function public.enqueue_consumer_catalog_category_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.enqueue_consumer_catalog_embedding(id, organization_id)
  from public.catalog_items
  where category_id = new.id;
  return new;
end;
$$;

create trigger consumer_catalog_item_embedding_insert
  after insert on public.catalog_items
  for each row execute function public.enqueue_consumer_catalog_item_change();

create trigger consumer_catalog_item_embedding_update
  after update of title, description, details, category_id, status, item_type on public.catalog_items
  for each row execute function public.enqueue_consumer_catalog_item_change();

create trigger consumer_catalog_channel_embedding_enqueue
  after insert or update or delete on public.catalog_item_channels
  for each row execute function public.enqueue_consumer_catalog_channel_change();

create trigger consumer_catalog_store_embedding_update
  after update of name, status on public.stores
  for each row execute function public.enqueue_consumer_catalog_store_change();

create trigger consumer_catalog_sales_channel_embedding_update
  after update of status on public.sales_channels
  for each row execute function public.enqueue_consumer_catalog_sales_channel_change();

create trigger consumer_catalog_category_embedding_update
  after update of name on public.catalog_categories
  for each row execute function public.enqueue_consumer_catalog_category_change();

insert into public.consumer_catalog_embedding_jobs (product_id, organization_id)
select products.id, items.organization_id
from public.discovery_products as products
join public.catalog_items as items on items.id = products.id
on conflict (product_id) do nothing;

create or replace function public.claim_consumer_catalog_embedding_jobs(p_limit integer default 24)
returns table (product_id uuid)
language sql
security invoker
set search_path = ''
as $$
  with picked as (
    select jobs.product_id
    from public.consumer_catalog_embedding_jobs as jobs
    where jobs.locked_until is null or jobs.locked_until < pg_catalog.now()
    order by jobs.queued_at
    for update skip locked
    limit greatest(1, least(p_limit, 48))
  )
  update public.consumer_catalog_embedding_jobs as jobs
  set locked_until = pg_catalog.now() + interval '2 minutes',
      attempts = jobs.attempts + 1
  from picked
  where jobs.product_id = picked.product_id
  returning jobs.product_id;
$$;

revoke all on function public.claim_consumer_catalog_embedding_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_consumer_catalog_embedding_jobs(integer) to service_role;

create or replace function public.match_consumer_catalog_embeddings(
  p_query_embedding extensions.vector(512),
  p_model text default 'BAAI/bge-small-zh-v1.5-onnx-quantized',
  p_match_count integer default 24,
  p_max_price numeric default null
)
returns table (product_id uuid, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    embeddings.product_id,
    (1 - (embeddings.embedding OPERATOR(extensions.<=>) p_query_embedding))::double precision
  from public.consumer_catalog_embeddings as embeddings
  join public.discovery_products as products on products.id = embeddings.product_id
  where embeddings.model = p_model
    and (p_max_price is null or (products.price > 0 and products.price <= p_max_price))
  order by embeddings.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit greatest(1, least(p_match_count, 50));
$$;

revoke all on function public.match_consumer_catalog_embeddings(extensions.vector(512), text, integer, numeric) from public, anon, authenticated;
grant execute on function public.match_consumer_catalog_embeddings(extensions.vector(512), text, integer, numeric) to service_role;
