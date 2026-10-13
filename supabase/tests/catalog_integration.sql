-- Run after seed.sql with a local postgres superuser.
begin;

do $$
declare
  item_count integer;
  variant_count integer;
  media_count integer;
  result_count integer;
begin
  select count(*) into item_count from public.catalog_items
    where organization_id = '00000000-0000-0000-0000-000000000001';
  if item_count <> 3 then raise exception 'expected 3 seeded catalog items, got %', item_count; end if;

  select count(*) into variant_count from public.catalog_variants
    where organization_id = '00000000-0000-0000-0000-000000000001';
  if variant_count <> 3 then raise exception 'expected 3 seeded variants, got %', variant_count; end if;

  select count(*) into media_count from public.catalog_media
    where organization_id = '00000000-0000-0000-0000-000000000001';
  if media_count <> 1 then raise exception 'expected 1 seeded media row, got %', media_count; end if;

  select count(*) into result_count
  from public.match_catalog_embeddings(
    '00000000-0000-0000-0000-000000000001',
    array_fill(0::real, array[1024])::extensions.vector,
    10, 0, null, 'text', 'Qwen3-Embedding'
  );
  if result_count <> 2 then raise exception 'expected 2 vector results, got %', result_count; end if;
end $$;

-- The composite FK must reject a variant assigned to another organization.
do $$
begin
  begin
    insert into public.catalog_variants (organization_id, catalog_item_id, title, price)
    values ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000001001', 'invalid', 1);
    raise exception 'cross-tenant variant insert was accepted';
  exception when foreign_key_violation then
    null;
  end;
end $$;

rollback;
