-- Do not expose storefront settings or arbitrary version rows to anonymous
-- clients. Publish a narrow projection with an explicit current-version join.
drop policy if exists storefronts_public_published_select on public.storefronts;
drop policy if exists storefront_versions_public_current_select on public.storefront_versions;
revoke select on public.storefronts, public.storefront_versions from anon;

create view public.published_storefronts
with (security_barrier = true)
as
select
  s.store_id,
  s.custom_domain,
  v.id as version_id,
  v.version_number,
  v.schema_document,
  v.published_at
from public.storefronts s
join public.storefront_versions v
  on v.id = s.published_version_id
 and v.store_id = s.store_id
 and v.organization_id = s.organization_id
where s.status = 'published'
  and v.status = 'published';

alter view public.published_storefronts owner to postgres;
revoke all on public.published_storefronts from public, anon, authenticated;
grant select on public.published_storefronts to anon;
