-- Remove the retired product-domain tables after the Catalog tables are ready.
-- The remote project was verified empty for these tables before this migration.

do $$
begin
  if to_regclass('public.product_attribute_values') is not null then
    execute 'drop trigger if exists product_attribute_values_projection_after_change on public.product_attribute_values';
    execute 'drop trigger if exists set_product_attribute_values_updated_at on public.product_attribute_values';
  end if;
  if to_regclass('public.product_search_documents') is not null then
    execute 'drop trigger if exists set_product_search_documents_updated_at on public.product_search_documents';
  end if;
  if to_regclass('public.products') is not null then
    execute 'drop trigger if exists set_products_updated_at on public.products';
  end if;
end $$;

drop function if exists public.product_attribute_values_projection_trigger();
drop function if exists public.refresh_product_search_document(uuid);

drop table if exists public.product_variant_option_values;
drop table if exists public.product_option_values;
drop table if exists public.product_attribute_values;
drop table if exists public.product_search_documents;
drop table if exists public.product_variants;
drop table if exists public.product_options;
drop table if exists public.products;
drop table if exists public.attribute_definitions;
