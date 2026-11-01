-- Narrow public projection for products explicitly published to Discover.
create view public.discovery_products
with (security_barrier = true)
as
select
  i.id,
  i.title,
  i.description,
  i.created_at,
  s.name as publisher_name,
  s.slug as publisher_slug,
  coalesce(m.storage_path, i.cover_image) as cover_image,
  v.price,
  v.currency_code,
  case when i.details->>'price_mode' = 'inquiry' then 'inquiry' else 'amount' end as price_mode,
  i.details->'outbound_links'->>'xiaohongshu' as xiaohongshu_url,
  i.details->'outbound_links'->>'douyin' as douyin_url
from public.catalog_item_channels cic
join public.sales_channels sc on sc.id = cic.channel_id
  and sc.organization_id = cic.organization_id
join public.catalog_items i on i.id = cic.catalog_item_id
  and i.organization_id = cic.organization_id
join public.stores s on s.id = cic.store_id
  and s.organization_id = cic.organization_id
left join lateral (
  select cv.price, cv.currency_code
  from public.catalog_variants cv
  where cv.catalog_item_id = i.id and cv.organization_id = i.organization_id
  order by cv.created_at, cv.id
  limit 1
) v on true
left join lateral (
  select cm.storage_path
  from public.catalog_media cm
  where cm.catalog_item_id = i.id and cm.organization_id = i.organization_id
    and cm.media_type = 'image'
  order by (cm.media_role = 'cover') desc, cm.created_at, cm.id
  limit 1
) m on true
where cic.is_visible = true
  and cic.store_id is not null
  and sc.code = 'storefront'
  and sc.channel_type = 'storefront'
  and sc.status = 'active'
  and i.status = 'active'
  and s.status = 'active'
  and (
    nullif(i.details->'outbound_links'->>'xiaohongshu', '') is not null
    or nullif(i.details->'outbound_links'->>'douyin', '') is not null
  );

alter view public.discovery_products owner to postgres;
revoke all on public.discovery_products from public, anon, authenticated;
grant select on public.discovery_products to anon, authenticated;
