-- Catalog integrity, indexes, RLS policy separation, and vector search.

alter table public.catalog_items add constraint catalog_items_id_organization_key unique (id, organization_id);
alter table public.catalog_variants add constraint catalog_variants_id_organization_key unique (id, organization_id);
alter table public.sales_channels add constraint sales_channels_id_organization_key unique (id, organization_id);
alter table public.demo_orders add constraint demo_orders_id_organization_key unique (id, organization_id);
alter table public.semantic_documents add constraint semantic_documents_id_organization_key unique (id, organization_id);

alter table public.catalog_variants add constraint catalog_variants_item_organization_fkey
  foreign key (catalog_item_id, organization_id) references public.catalog_items (id, organization_id) on delete cascade;
alter table public.catalog_media add constraint catalog_media_item_organization_fkey
  foreign key (catalog_item_id, organization_id) references public.catalog_items (id, organization_id) on delete cascade;
alter table public.catalog_media add constraint catalog_media_variant_organization_fkey
  foreign key (variant_id, organization_id) references public.catalog_variants (id, organization_id) on delete set null;
alter table public.catalog_item_channels add constraint catalog_item_channels_item_organization_fkey
  foreign key (catalog_item_id, organization_id) references public.catalog_items (id, organization_id) on delete cascade;
alter table public.catalog_item_channels add constraint catalog_item_channels_channel_organization_fkey
  foreign key (channel_id, organization_id) references public.sales_channels (id, organization_id) on delete cascade;
alter table public.demo_orders add constraint demo_orders_channel_organization_fkey
  foreign key (channel_id, organization_id) references public.sales_channels (id, organization_id) on delete set null;
alter table public.demo_order_items add constraint demo_order_items_order_organization_fkey
  foreign key (order_id, organization_id) references public.demo_orders (id, organization_id) on delete cascade;
alter table public.demo_order_items add constraint demo_order_items_item_organization_fkey
  foreign key (catalog_item_id, organization_id) references public.catalog_items (id, organization_id) on delete restrict;
alter table public.demo_order_items add constraint demo_order_items_variant_organization_fkey
  foreign key (variant_id, organization_id) references public.catalog_variants (id, organization_id) on delete restrict;
alter table public.semantic_embeddings add constraint semantic_embeddings_document_organization_fkey
  foreign key (document_id, organization_id) references public.semantic_documents (id, organization_id) on delete cascade;

create index catalog_variants_org_item_idx on public.catalog_variants (organization_id, catalog_item_id, created_at);
create index catalog_media_org_item_idx on public.catalog_media (organization_id, catalog_item_id, media_role, created_at);
create index catalog_media_org_variant_idx on public.catalog_media (organization_id, variant_id) where variant_id is not null;
create index catalog_item_channels_org_channel_idx on public.catalog_item_channels (organization_id, channel_id, is_visible, is_purchasable);
create index demo_orders_org_channel_idx on public.demo_orders (organization_id, channel_id, created_at desc);
create index demo_order_items_org_order_idx on public.demo_order_items (organization_id, order_id);
create index demo_order_items_org_item_variant_idx on public.demo_order_items (organization_id, catalog_item_id, variant_id);
create index organizations_owner_user_idx on public.organizations (owner_user_id) where owner_user_id is not null;

do $$
declare
  target text;
begin
  foreach target in array array[
    'catalog_items','catalog_variants','catalog_media','sales_channels',
    'catalog_item_channels','semantic_documents','semantic_embeddings',
    'demo_orders','demo_order_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', target || '_editor_write', target);
  end loop;
end $$;

create policy catalog_items_editor_insert on public.catalog_items for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_items_editor_update on public.catalog_items for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_items_editor_delete on public.catalog_items for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create policy catalog_variants_editor_insert on public.catalog_variants for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_variants_editor_update on public.catalog_variants for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_variants_editor_delete on public.catalog_variants for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create policy catalog_media_editor_insert on public.catalog_media for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_media_editor_update on public.catalog_media for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_media_editor_delete on public.catalog_media for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create policy sales_channels_admin_insert on public.sales_channels for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin']));
create policy sales_channels_admin_update on public.sales_channels for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin']))
  with check (private.is_org_member(organization_id, array['owner','admin']));
create policy sales_channels_admin_delete on public.sales_channels for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin']));

create policy catalog_item_channels_editor_insert on public.catalog_item_channels for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_item_channels_editor_update on public.catalog_item_channels for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy catalog_item_channels_editor_delete on public.catalog_item_channels for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create policy semantic_documents_editor_insert on public.semantic_documents for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy semantic_documents_editor_update on public.semantic_documents for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy semantic_documents_editor_delete on public.semantic_documents for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create policy semantic_embeddings_editor_insert on public.semantic_embeddings for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy semantic_embeddings_editor_update on public.semantic_embeddings for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy semantic_embeddings_editor_delete on public.semantic_embeddings for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create policy demo_orders_editor_insert on public.demo_orders for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy demo_orders_editor_update on public.demo_orders for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy demo_orders_editor_delete on public.demo_orders for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create policy demo_order_items_editor_insert on public.demo_order_items for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy demo_order_items_editor_update on public.demo_order_items for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy demo_order_items_editor_delete on public.demo_order_items for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));

create or replace function public.match_catalog_embeddings(
  p_organization_id uuid,
  p_query_embedding extensions.vector(1024),
  p_match_count integer default 10,
  p_similarity_threshold double precision default 0,
  p_channel_id uuid default null,
  p_modality text default 'text',
  p_model text default 'Qwen3-Embedding'
)
returns table (
  catalog_item_id uuid,
  catalog_variant_id uuid,
  catalog_media_id uuid,
  document_id uuid,
  similarity double precision,
  content text
)
language sql stable security invoker
set search_path = public, extensions
as $$
  select
    case when sd.entity_type = 'catalog_item' then sd.entity_id
         when sd.entity_type = 'catalog_variant' then cv.catalog_item_id
         when sd.entity_type = 'catalog_media' then cm.catalog_item_id end,
    case when sd.entity_type = 'catalog_variant' then sd.entity_id end,
    case when sd.entity_type = 'catalog_media' then sd.entity_id end,
    sd.id,
    (1 - (se.embedding <=> p_query_embedding))::double precision,
    sd.content
  from public.semantic_embeddings se
  join public.semantic_documents sd on sd.id = se.document_id
  left join public.catalog_variants cv
    on sd.entity_type = 'catalog_variant'
   and cv.id = sd.entity_id
   and cv.organization_id = sd.organization_id
  left join public.catalog_media cm
    on sd.entity_type = 'catalog_media'
   and cm.id = sd.entity_id
   and cm.organization_id = sd.organization_id
  left join public.catalog_item_channels cic
    on p_channel_id is not null
   and cic.channel_id = p_channel_id
   and cic.organization_id = p_organization_id
   and cic.catalog_item_id = case when sd.entity_type = 'catalog_item' then sd.entity_id
                                  when sd.entity_type = 'catalog_variant' then cv.catalog_item_id
                                  when sd.entity_type = 'catalog_media' then cm.catalog_item_id end
  where se.organization_id = p_organization_id
    and sd.organization_id = p_organization_id
    and se.modality = p_modality
    and se.model = p_model
    and (p_channel_id is null or (cic.is_visible and cic.is_purchasable))
    and (1 - (se.embedding <=> p_query_embedding)) >= p_similarity_threshold
  order by se.embedding <=> p_query_embedding
  limit greatest(1, least(p_match_count, 100));
$$;

revoke all on function public.match_catalog_embeddings(
  uuid, extensions.vector(1024), integer, double precision, uuid, text, text
) from public;
grant execute on function public.match_catalog_embeddings(
  uuid, extensions.vector(1024), integer, double precision, uuid, text, text
) to authenticated;
