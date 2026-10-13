-- Scope canonical catalog products to a store within shared sales channels.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stores_id_organization_key'
      and conrelid = 'public.stores'::regclass
  ) then
    alter table public.stores
      add constraint stores_id_organization_key unique (id, organization_id);
  end if;
end;
$$;

alter table public.catalog_item_channels
  add column store_id uuid;

alter table public.catalog_item_channels
  add constraint catalog_item_channels_store_organization_fkey
  foreign key (store_id, organization_id)
  references public.stores (id, organization_id) on delete cascade;

-- Safely attach legacy channel assignments only where an organization has one
-- store. Multi-store organizations must explicitly assign products per store.
with single_store_organizations as (
  select organization_id, min(id::text)::uuid as store_id
  from public.stores
  group by organization_id
  having count(*) = 1
)
update public.catalog_item_channels c
set store_id = s.store_id
from single_store_organizations s
where c.organization_id = s.organization_id;

alter table public.catalog_item_channels
  drop constraint if exists catalog_item_channels_catalog_item_id_channel_id_key;

create unique index catalog_item_channels_legacy_scope_unique_idx
  on public.catalog_item_channels (organization_id, catalog_item_id, channel_id)
  where store_id is null;
create unique index catalog_item_channels_store_scope_unique_idx
  on public.catalog_item_channels (organization_id, catalog_item_id, channel_id, store_id)
  where store_id is not null;

create index catalog_item_channels_store_visibility_idx
  on public.catalog_item_channels (store_id, channel_id, is_visible, published_at desc)
  where store_id is not null;

-- Public storefront reads can only see the storefront channel and assignments
-- a merchant explicitly marks visible. Column grants keep internal fields out.
revoke all on table public.sales_channels from anon, public;
grant select (id, organization_id, code, channel_type, status)
  on public.sales_channels to anon, authenticated;
create policy sales_channels_public_storefront_select on public.sales_channels
  for select to anon
  using (channel_type = 'storefront' and status = 'active');

revoke all on table public.catalog_item_channels from anon, public;
grant select (organization_id, catalog_item_id, channel_id, store_id, is_visible)
  on public.catalog_item_channels to anon;
create policy catalog_item_channels_public_visible_select on public.catalog_item_channels
  for select to anon
  using (
    is_visible = true
    and store_id is not null
    and exists (
      select 1 from public.sales_channels sc
      where sc.id = catalog_item_channels.channel_id
        and sc.organization_id = catalog_item_channels.organization_id
        and sc.code = 'storefront'
        and sc.channel_type = 'storefront'
        and sc.status = 'active'
    )
  );

-- Preserve existing public storefront items for single-store organizations.
-- Multi-store organizations are left for an explicit store-level assignment.
with single_store_organizations as (
  select organization_id, min(id::text)::uuid as store_id
  from public.stores
  group by organization_id
  having count(*) = 1
), inserted_storefront_channels as (
  insert into public.sales_channels (organization_id, code, name, channel_type, status)
  select o.id, 'storefront', 'C 端商城', 'storefront', 'active'
  from public.organizations o
  on conflict (organization_id, code) do nothing
  returning id, organization_id
), storefront_channels as (
  select c.id, c.organization_id
  from public.sales_channels c
  join public.organizations o on o.id = c.organization_id
  where c.code = 'storefront' and c.channel_type = 'storefront' and c.status = 'active'
  union
  select id, organization_id from inserted_storefront_channels
)
insert into public.catalog_item_channels (
  organization_id, catalog_item_id, channel_id, store_id, is_visible, is_purchasable, published_at
)
select i.organization_id, i.id, c.id, s.store_id, true, true, now()
from public.catalog_items i
join single_store_organizations s using (organization_id)
join storefront_channels c using (organization_id)
where i.status = 'active'
on conflict (organization_id, catalog_item_id, channel_id, store_id)
  where store_id is not null
  do nothing;

