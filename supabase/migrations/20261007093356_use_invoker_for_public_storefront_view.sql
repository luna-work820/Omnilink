-- Keep the public view invoker-security. Column grants and RLS expose only
-- the current published snapshot while preventing reads of storefront settings.
alter view public.published_storefronts
  set (security_invoker = true);

grant select (store_id, organization_id, status, custom_domain, published_version_id)
  on public.storefronts to anon;
grant select (id, store_id, organization_id, status, version_number, schema_document, published_at)
  on public.storefront_versions to anon;

create policy storefronts_public_published_select on public.storefronts
  for select to anon using (status = 'published' and published_version_id is not null);
create policy storefront_versions_public_current_select on public.storefront_versions
  for select to anon using (
    status = 'published' and exists (
      select 1 from public.storefronts s
      where s.store_id = storefront_versions.store_id
        and s.organization_id = storefront_versions.organization_id
        and s.status = 'published'
        and s.published_version_id = storefront_versions.id
    )
  );
