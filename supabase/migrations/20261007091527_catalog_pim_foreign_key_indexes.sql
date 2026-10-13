-- Cover foreign keys added by catalog_pim_and_storefront_generation.
create index catalog_categories_parent_organization_idx
  on public.catalog_categories (parent_id, organization_id)
  where parent_id is not null;
create index catalog_contents_item_organization_fk_idx
  on public.catalog_contents (catalog_item_id, organization_id);
create index catalog_contents_created_by_idx
  on public.catalog_contents (created_by) where created_by is not null;
create index catalog_contents_reviewed_by_idx
  on public.catalog_contents (reviewed_by) where reviewed_by is not null;
create index catalog_item_attributes_item_organization_fk_idx
  on public.catalog_item_attributes (catalog_item_id, organization_id);
create index catalog_item_attributes_reviewed_by_idx
  on public.catalog_item_attributes (reviewed_by) where reviewed_by is not null;
create index catalog_item_change_sets_proposed_by_idx
  on public.catalog_item_change_sets (proposed_by) where proposed_by is not null;
create index catalog_item_change_sets_reviewed_by_idx
  on public.catalog_item_change_sets (reviewed_by) where reviewed_by is not null;
create index catalog_item_relations_target_organization_fk_idx
  on public.catalog_item_relations (target_item_id, organization_id);
create index catalog_item_sources_item_organization_fk_idx
  on public.catalog_item_sources (catalog_item_id, organization_id);
create index catalog_item_sources_source_organization_fk_idx
  on public.catalog_item_sources (source_id, organization_id);
create index catalog_sources_created_by_idx
  on public.catalog_sources (created_by) where created_by is not null;
create index merchant_profile_revisions_changed_by_idx
  on public.merchant_profile_revisions (changed_by) where changed_by is not null;
create index storefront_versions_store_organization_fk_idx
  on public.storefront_versions (store_id, organization_id);
create index storefront_versions_created_by_idx
  on public.storefront_versions (created_by) where created_by is not null;
create index storefront_versions_reviewed_by_idx
  on public.storefront_versions (reviewed_by) where reviewed_by is not null;
create index storefronts_draft_version_store_org_idx
  on public.storefronts (draft_version_id, store_id, organization_id)
  where draft_version_id is not null;
create index storefronts_published_version_store_org_idx
  on public.storefronts (published_version_id, store_id, organization_id)
  where published_version_id is not null;
