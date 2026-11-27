begin;

create or replace function private.normalize_consumer_composition(p_value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  item record;
  normalized_items jsonb := '[]'::jsonb;
  normalized_name text;
  item_position integer;
begin
  if jsonb_typeof(p_value) is distinct from 'object'
    or jsonb_typeof(p_value->'items') is distinct from 'array' then
    return p_value;
  end if;

  for item in
    select value, ordinality
    from jsonb_array_elements(p_value->'items') with ordinality as entries(value, ordinality)
  loop
    if jsonb_typeof(item.value->'name') = 'string' then
      normalized_name := lower(regexp_replace(normalize(btrim(item.value->>'name'), NFKC), '[[:space:]]+', ' ', 'g'));
    else
      normalized_name := null;
    end if;

    if jsonb_typeof(item.value->'position') = 'number'
      and item.value->>'position' ~ '^[1-9][0-9]{0,5}$' then
      item_position := (item.value->>'position')::integer;
    else
      item_position := item.ordinality::integer;
    end if;

    normalized_items := normalized_items || jsonb_build_array(
      jsonb_strip_nulls(item.value || jsonb_build_object(
        'position', item_position,
        'normalizedName', normalized_name
      ))
    );
  end loop;

  return jsonb_strip_nulls(p_value || jsonb_build_object('items', normalized_items));
end;
$$;

create or replace function private.consumer_composition_from_product(p_product jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  field record;
  best_priority integer;
  selected_fields jsonb := '[]'::jsonb;
  labels_text text;
  values_text text;
  raw_text text;
  composition_kind text;
  category text := coalesce(p_product->>'category', '');
  items jsonb := '[]'::jsonb;
  parts text[];
  part text;
  entry_name text;
  item_value jsonb;
  match_groups text[];
  next_position integer := 0;
  observed_at text;
  source_url text;
begin
  for field in
    select
      key,
      value,
      case
        when key ~* '(全成分|完整成分表|完整配方|INCI|full ingredients)' then 0
        when key ~* '(面料成分|纤维成分|材质成分)' then 1
        when key ~* '(主要成分|成分表|ingredient|composition)' then 2
        when key ~* '(材质|材料|面料|纤维|金属|material)' then 3
      end as priority
    from jsonb_each_text(
      case when jsonb_typeof(p_product->'specs') = 'object' then p_product->'specs' else '{}'::jsonb end
    ) as specs(key, value)
    where key ~* '(全成分|完整成分表|完整配方|INCI|full ingredients|面料成分|纤维成分|材质成分|主要成分|成分表|ingredient|composition|材质|材料|面料|纤维|金属|material)'
      and nullif(btrim(value), '') is not null
      and value !~* '(资料未确认|待确认|未确认|未核验|未知|unknown|not available|not provided|n/?a)'
      and value !~* '^https?://'
    order by priority, key
  loop
    if best_priority is null then
      best_priority := field.priority;
    end if;
    if field.priority = best_priority then
      selected_fields := selected_fields || jsonb_build_array(jsonb_build_object(
        'label', field.key,
        'value', btrim(field.value)
      ));
    end if;
  end loop;

  if jsonb_array_length(selected_fields) = 0 then
    return jsonb_build_object('kind', 'unknown', 'status', 'not_provided', 'items', '[]'::jsonb);
  end if;

  select
    string_agg(entry->>'label', ' ' order by ordinal),
    string_agg(entry->>'value', ' ' order by ordinal),
    string_agg((entry->>'label') || ': ' || (entry->>'value'), E'\n' order by ordinal)
  into labels_text, values_text, raw_text
  from jsonb_array_elements(selected_fields) with ordinality as selected(entry, ordinal);

  if category ~* '(个护|美妆|洗护|护肤|化妆品|香水|shampoo|conditioner|body wash|cosmetic|beauty|hair care)'
    or labels_text ~* '(INCI|full ingredients|全成分|完整配方|ingredients?)' then
    composition_kind := 'cosmetic-inci';
  elsif labels_text ~* '(面料|纤维)'
    or values_text ~* '(羊毛|棉|亚麻|真丝|涤纶|wool|cotton|linen|silk|polyester)' then
    composition_kind := 'textile-fiber';
  elsif values_text ~* '(925|950|999|sterling silver|pure silver|纯银|足银)' then
    composition_kind := 'metal-alloy';
  else
    composition_kind := 'material';
  end if;

  for field in
    select entry->>'label' as label, entry->>'value' as value
    from jsonb_array_elements(selected_fields) as selected(entry)
  loop
    parts := regexp_split_to_array(field.value, '[,，;；、/' || chr(10) || chr(13) || ']+');
    foreach part in array parts loop
      entry_name := btrim(part);
      if entry_name = '' then
        continue;
      end if;

      next_position := next_position + 1;
      item_value := jsonb_build_object(
        'name', entry_name,
        'position', next_position,
        'sourceLabel', field.label
      );

      if composition_kind = 'textile-fiber' then
        match_groups := regexp_match(entry_name, '^([0-9]+[.]?[0-9]*[[:space:]]*%)[[:space:]]*(.+)$');
        if match_groups is not null then
          item_value := jsonb_set(item_value, '{name}', to_jsonb(btrim(match_groups[2])));
          item_value := item_value || jsonb_build_object('proportion', regexp_replace(match_groups[1], '[[:space:]]', '', 'g'));
        end if;
      elsif composition_kind = 'metal-alloy' then
        match_groups := regexp_match(entry_name, '(925|950|999)');
        if match_groups is not null then
          item_value := item_value || jsonb_build_object('purity', match_groups[1]);
        end if;
      end if;

      items := items || jsonb_build_array(item_value);
    end loop;
  end loop;

  if jsonb_array_length(items) = 0 then
    return jsonb_build_object('kind', 'unknown', 'status', 'not_provided', 'items', '[]'::jsonb);
  end if;

  observed_at := coalesce(p_product->>'sourceDate', p_product->'catalogEvidence'->>'reviewedAt');
  source_url := coalesce(p_product->>'sourceUrl', p_product->'specs'->>'商品来源');
  if source_url !~ '^https://' then
    source_url := null;
  end if;

  return private.normalize_consumer_composition(jsonb_strip_nulls(jsonb_build_object(
    'kind', composition_kind,
    'status', 'partial',
    'items', items,
    'rawText', raw_text,
    'sourceUrl', source_url,
    'observedAt', observed_at
  )));
end;
$$;

create or replace function private.consumer_composition_is_valid(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  property_name text;
  allowed_properties text[] := array['proportion', 'purity', 'role', 'sourceLabel'];
begin
  if jsonb_typeof(p_value) is distinct from 'object'
    or coalesce(p_value->>'kind', '') not in ('cosmetic-inci', 'textile-fiber', 'metal-alloy', 'material', 'other', 'unknown')
    or coalesce(p_value->>'status', '') not in ('verified', 'partial', 'not_provided', 'not_applicable')
    or jsonb_typeof(p_value->'items') is distinct from 'array'
    or jsonb_array_length(p_value->'items') > 500 then
    return false;
  end if;

  if p_value->>'status' in ('not_provided', 'not_applicable')
    and jsonb_array_length(p_value->'items') > 0 then
    return false;
  end if;

  if p_value ? 'rawText' and (jsonb_typeof(p_value->'rawText') is distinct from 'string' or char_length(p_value->>'rawText') > 20000) then
    return false;
  end if;
  if p_value ? 'region' and jsonb_typeof(p_value->'region') is distinct from 'string' then return false; end if;
  if p_value ? 'sourceUrl' and (jsonb_typeof(p_value->'sourceUrl') is distinct from 'string' or p_value->>'sourceUrl' !~ '^https://') then return false; end if;
  if p_value ? 'observedAt' and jsonb_typeof(p_value->'observedAt') is distinct from 'string' then return false; end if;
  if p_value ? 'verifiedAt' and jsonb_typeof(p_value->'verifiedAt') is distinct from 'string' then return false; end if;

  for item in select value from jsonb_array_elements(p_value->'items') as entries(value) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'name') is distinct from 'string'
      or char_length(btrim(item->>'name')) not between 1 and 300
      or jsonb_typeof(item->'normalizedName') is distinct from 'string'
      or item->>'normalizedName' is distinct from lower(regexp_replace(normalize(btrim(item->>'name'), NFKC), '[[:space:]]+', ' ', 'g'))
      or jsonb_typeof(item->'position') is distinct from 'number'
      or item->>'position' !~ '^[1-9][0-9]{0,5}$' then
      return false;
    end if;

    foreach property_name in array allowed_properties loop
      if item ? property_name and jsonb_typeof(item->property_name) is distinct from 'string' then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

revoke all on function private.normalize_consumer_composition(jsonb) from public, anon, authenticated;
revoke all on function private.consumer_composition_from_product(jsonb) from public, anon, authenticated;
revoke all on function private.consumer_composition_is_valid(jsonb) from public, anon, authenticated;
grant execute on function private.normalize_consumer_composition(jsonb) to service_role;
grant execute on function private.consumer_composition_from_product(jsonb) to service_role;
grant execute on function private.consumer_composition_is_valid(jsonb) to service_role;

alter table public.consumer_catalog_products
  add column recommendable boolean not null default false;

update public.consumer_catalog_products
set product = jsonb_set(
  product,
  '{composition}',
  case
    when jsonb_typeof(product->'composition') = 'object'
      then private.normalize_consumer_composition(product->'composition')
    else private.consumer_composition_from_product(product)
  end,
  true
);

alter table public.consumer_catalog_products
  add column composition jsonb generated always as (product->'composition') stored not null,
  add constraint consumer_catalog_product_composition_valid
    check (private.consumer_composition_is_valid(composition));

comment on column public.consumer_catalog_products.composition is
  'Shared, queryable composition for ingredients, textile fibers, metal alloys, and other materials. Product JSON remains the source of truth.';
comment on column public.consumer_catalog_products.recommendable is
  'Allows the private recommendation catalog to use a product independently of its public Discover publication status.';

grant select (composition) on public.consumer_catalog_products to anon, authenticated;

create index consumer_catalog_products_composition_gin
  on public.consumer_catalog_products using gin (composition jsonb_path_ops)
  where published or recommendable;
create index consumer_catalog_products_recommendable_idx
  on public.consumer_catalog_products (id) where recommendable;

drop function public.upsert_consumer_catalog_product(text, jsonb, text, timestamptz, boolean);

create function public.upsert_consumer_catalog_product(
  p_url text,
  p_product jsonb,
  p_source_type text,
  p_captured_at timestamptz,
  p_publish boolean default false,
  p_recommendable boolean default false
) returns text
language plpgsql security invoker set search_path = '' as $$
declare result_id text;
begin
  if p_url !~ '^https://' or jsonb_typeof(p_product) <> 'object'
     or coalesce(p_product->>'id', '') = '' or p_product->>'sourceUrl' is distinct from p_url or p_captured_at is null then
    raise exception 'INVALID_CATALOG_PRODUCT' using errcode = '22023';
  end if;

  if jsonb_typeof(p_product->'composition') = 'object' then
    p_product := jsonb_set(p_product, '{composition}', private.normalize_consumer_composition(p_product->'composition'), true);
  else
    p_product := jsonb_set(p_product, '{composition}', private.consumer_composition_from_product(p_product), true);
  end if;
  if not private.consumer_composition_is_valid(p_product->'composition') then
    raise exception 'INVALID_CATALOG_PRODUCT_COMPOSITION' using errcode = '22023';
  end if;

  insert into public.consumer_catalog_products as existing
    (id, canonical_url, product, source_type, captured_at, published, recommendable)
  values (p_product->>'id', p_url, p_product, p_source_type, p_captured_at,
    coalesce(p_publish, false), coalesce(p_recommendable, false))
  on conflict (canonical_url) do update set
    product = jsonb_set(excluded.product, '{id}', to_jsonb(existing.id)),
    source_type = excluded.source_type,
    captured_at = excluded.captured_at,
    published = existing.published or excluded.published,
    recommendable = existing.recommendable or excluded.recommendable,
    updated_at = now()
  where excluded.captured_at >= existing.captured_at
  returning id into result_id;
  if result_id is null then
    select id into result_id from public.consumer_catalog_products where canonical_url = p_url;
  end if;
  return result_id;
end;
$$;

revoke all on function public.upsert_consumer_catalog_product(text,jsonb,text,timestamptz,boolean,boolean) from public,anon,authenticated;
grant execute on function public.upsert_consumer_catalog_product(text,jsonb,text,timestamptz,boolean,boolean) to service_role;

-- Wash-care samples are stored for recommendation filtering and remain unpublished until their listing metadata is complete.
DO $wash_care_seed$
BEGIN
  perform public.upsert_consumer_catalog_product(
    'https://www.vanicream.com/product/free-and-clear-shampoo',
    '{"id":"vanicream-shampoo-us","name":"Vanicream Shampoo","creator":"Vanicream","itemType":"product","price":0,"formattedPrice":"待核价","priceMode":"unknown","mainImage":"","secondaryImages":[],"aspectRatio":1,"category":"洗护","shortDescription":"Non-medicated shampoo for sensitive skin","aiSummary":"Non-medicated shampoo for sensitive skin；Helps remove flaking and scaling; controls oily scalp；Fragrance-free, sulfate-free and protein-free；No botanical extracts or essential oils; pH balanced","reviews":[],"specs":{"市场":"US","产品类别":"洗发水","规格":"2 oz、12 oz"},"composition":{"kind":"cosmetic-inci","status":"verified","region":"US","items":[{"name":"water","position":1,"normalizedName":"water"},{"name":"lauryl glucoside","position":2,"normalizedName":"lauryl glucoside"},{"name":"coco-glucoside","position":3,"normalizedName":"coco-glucoside"},{"name":"acrylates copolymer","position":4,"normalizedName":"acrylates copolymer"},{"name":"sodium cocoyl glutamate","position":5,"normalizedName":"sodium cocoyl glutamate"},{"name":"sodium cocoyl glycinate","position":6,"normalizedName":"sodium cocoyl glycinate"},{"name":"glycerin","position":7,"normalizedName":"glycerin"},{"name":"sucrose cocoate","position":8,"normalizedName":"sucrose cocoate"},{"name":"panthenol","position":9,"normalizedName":"panthenol"},{"name":"pentylene glycol","position":10,"normalizedName":"pentylene glycol"},{"name":"1,2-hexanediol","position":11,"normalizedName":"1,2-hexanediol"},{"name":"disodium EDTA","position":12,"normalizedName":"disodium edta"},{"name":"caprylyl glycol","position":13,"normalizedName":"caprylyl glycol"},{"name":"sodium hydroxide","position":14,"normalizedName":"sodium hydroxide"},{"name":"sodium chloride","position":15,"normalizedName":"sodium chloride"}],"rawText":"water, lauryl glucoside, coco-glucoside, acrylates copolymer, sodium cocoyl glutamate, sodium cocoyl glycinate, glycerin, sucrose cocoate, panthenol, pentylene glycol, 1,2-hexanediol, disodium EDTA, caprylyl glycol, sodium hydroxide, sodium chloride","sourceUrl":"https://www.vanicream.com/product/free-and-clear-shampoo","verifiedAt":"2026-11-22"},"storeName":"Vanicream","sourceUrl":"https://www.vanicream.com/product/free-and-clear-shampoo","sourceDate":"2026-11-22","recommendationFacets":{"hairTypes":[],"scalpNeeds":["sensitive","oil-control"],"hairGoals":["保持清爽"],"bodySkinNeeds":[],"bodySkinGoals":[],"formulaClaims":["无香精","无 SLS/SLES","无蛋白质","无植物提取物和精油"]},"formulaFacts":{"fragranceIngredientsListed":false,"slsSlesListed":false,"proteinIngredientListed":false},"manufacturerClaims":["Non-medicated shampoo for sensitive skin","Helps remove flaking and scaling; controls oily scalp","Fragrance-free, sulfate-free and protein-free","No botanical extracts or essential oils; pH balanced"],"productType":"shampoo","formulaMarket":"US","packagingVariants":["2 oz","12 oz"],"source":{"kind":"brand_official_product_page","url":"https://www.vanicream.com/product/free-and-clear-shampoo","verifiedAt":"2026-11-22"},"catalogEvidence":{"sourceType":"official_store","reviewedAt":"2026-11-22","productPageStatus":"fetched","listingUrl":"https://www.vanicream.com/product/free-and-clear-shampoo","priceStatus":"unconfirmed","stockStatus":"unknown","deliveryToChina":"unverified","checkoutVerified":false,"imageStatus":"source_url_only"}}'::jsonb,
    'sample',
    '2026-11-22T00:00:00Z'::timestamptz,
    false,
    true
  );
  perform public.upsert_consumer_catalog_product(
    'https://innersensebeauty.com/collections/dull/products/pure-harmony',
    '{"id":"innersense-pure-harmony-hairbath-us","name":"Pure Harmony Hairbath","creator":"Innersense Organic Beauty","itemType":"product","price":0,"formattedPrice":"待核价","priceMode":"unknown","mainImage":"","secondaryImages":[],"aspectRatio":1,"category":"洗护","shortDescription":"Volumizing shampoo for fine to medium hair","aiSummary":"Volumizing shampoo for fine to medium hair；For oily scalp; deeply cleanses and builds body and volume；Sulfate-free (SLS/SLES)；Fragrance notes: orange and tangerine","reviews":[],"specs":{"市场":"US","产品类别":"洗发水","规格":"2 oz、10 oz、32 oz、32 oz refill"},"composition":{"kind":"cosmetic-inci","status":"verified","region":"US","items":[{"name":"Water/Aqua/EAU","position":1,"normalizedName":"water/aqua/eau"},{"name":"Cocamidopropyl Hydroxysultaine","position":2,"normalizedName":"cocamidopropyl hydroxysultaine"},{"name":"Sodium Cocoyl Isethionate","position":3,"normalizedName":"sodium cocoyl isethionate"},{"name":"Caprylyl/Capryl Glucoside","position":4,"normalizedName":"caprylyl/capryl glucoside"},{"name":"Glycerin","position":5,"normalizedName":"glycerin"},{"name":"Sodium Chloride","position":6,"normalizedName":"sodium chloride"},{"name":"Sodium Lauroyl Methyl Isethionate","position":7,"normalizedName":"sodium lauroyl methyl isethionate"},{"name":"Butyrosepermum Parkii (Shea Butter)","position":8,"normalizedName":"butyrosepermum parkii (shea butter)"},{"name":"Citrus Aurantium Dulcis (Orange) Peel Oil","position":9,"normalizedName":"citrus aurantium dulcis (orange) peel oil"},{"name":"Citrus Medica Limonum (Lemon) Peel Oil","position":10,"normalizedName":"citrus medica limonum (lemon) peel oil"},{"name":"Eucalyptus Globulus (Eucalyptus)","position":11,"normalizedName":"eucalyptus globulus (eucalyptus)"},{"name":"Cucurbita Pepo (Pumpkin Seed Oil)*","position":12,"normalizedName":"cucurbita pepo (pumpkin seed oil)*"},{"name":"Hydroxypropyltrimonium Honey","position":13,"normalizedName":"hydroxypropyltrimonium honey"},{"name":"Hydrolyzed Quinoa","position":14,"normalizedName":"hydrolyzed quinoa"},{"name":"Trisodium Ethylenediamine Disuccinate","position":15,"normalizedName":"trisodium ethylenediamine disuccinate"},{"name":"Sodium Benzoate","position":16,"normalizedName":"sodium benzoate"},{"name":"Hydrolyzed Rice Protein","position":17,"normalizedName":"hydrolyzed rice protein"},{"name":"Guar Hydroxypropyltrimonium Chloride","position":18,"normalizedName":"guar hydroxypropyltrimonium chloride"},{"name":"Persea Gratissima (Avocado) Oil","position":19,"normalizedName":"persea gratissima (avocado) oil"},{"name":"Oryza Sativa (Rice) Bran Oil","position":20,"normalizedName":"oryza sativa (rice) bran oil"},{"name":"Camellia Sinensis (Green Tea) Leaf Extract*","position":21,"normalizedName":"camellia sinensis (green tea) leaf extract*"},{"name":"Cucumis Sativus (Cucumber) Fruit Extract","position":22,"normalizedName":"cucumis sativus (cucumber) fruit extract"},{"name":"Persea Gratissima (Avocado)* Fruit Extract","position":23,"normalizedName":"persea gratissima (avocado)* fruit extract"},{"name":"Mangifera Indica (Mango)* Fruit Extract","position":24,"normalizedName":"mangifera indica (mango)* fruit extract"}],"rawText":"Water/Aqua/EAU, Cocamidopropyl Hydroxysultaine, Sodium Cocoyl Isethionate, Caprylyl/Capryl Glucoside, Glycerin, Sodium Chloride, Sodium Lauroyl Methyl Isethionate, Butyrosepermum Parkii (Shea Butter), Citrus Aurantium Dulcis (Orange) Peel Oil, Citrus Medica Limonum (Lemon) Peel Oil, Eucalyptus Globulus (Eucalyptus), Cucurbita Pepo (Pumpkin Seed Oil)*, Hydroxypropyltrimonium Honey, Hydrolyzed Quinoa, Trisodium Ethylenediamine Disuccinate, Sodium Benzoate, Hydrolyzed Rice Protein, Guar Hydroxypropyltrimonium Chloride, Persea Gratissima (Avocado) Oil, Oryza Sativa (Rice) Bran Oil, Camellia Sinensis (Green Tea) Leaf Extract*, Cucumis Sativus (Cucumber) Fruit Extract, Persea Gratissima (Avocado)* Fruit Extract, Mangifera Indica (Mango)* Fruit Extract","sourceUrl":"https://innersensebeauty.com/collections/dull/products/pure-harmony","verifiedAt":"2026-11-22"},"storeName":"Innersense Organic Beauty","sourceUrl":"https://innersensebeauty.com/collections/dull/products/pure-harmony","sourceDate":"2026-11-22","recommendationFacets":{"hairTypes":["fine-to-medium"],"scalpNeeds":["oily"],"hairGoals":["保持清爽","更蓬松"],"bodySkinNeeds":[],"bodySkinGoals":[],"formulaClaims":["无 SLS/SLES"]},"formulaFacts":{"fragranceIngredientsListed":true,"slsSlesListed":false,"proteinIngredientListed":true},"manufacturerClaims":["Volumizing shampoo for fine to medium hair","For oily scalp; deeply cleanses and builds body and volume","Sulfate-free (SLS/SLES)","Fragrance notes: orange and tangerine"],"productType":"shampoo","formulaMarket":"US","packagingVariants":["2 oz","10 oz","32 oz","32 oz refill"],"source":{"kind":"brand_official_product_page","url":"https://innersensebeauty.com/collections/dull/products/pure-harmony","verifiedAt":"2026-11-22"},"catalogEvidence":{"sourceType":"official_store","reviewedAt":"2026-11-22","productPageStatus":"fetched","listingUrl":"https://innersensebeauty.com/collections/dull/products/pure-harmony","priceStatus":"unconfirmed","stockStatus":"unknown","deliveryToChina":"unverified","checkoutVerified":false,"imageStatus":"source_url_only"},"notes":"公式中列有橙皮油、柠檬皮油、桉树成分及水解蛋白；不标记为无香精或无蛋白质。"}'::jsonb,
    'sample',
    '2026-11-22T00:00:00Z'::timestamptz,
    false,
    true
  );
  perform public.upsert_consumer_catalog_product(
    'https://innersensebeauty.com/collections/build-up-dandruff/products/hydrating-cream-hairbath',
    '{"id":"innersense-hydrating-cream-hairbath-us","name":"Hydrating Cream Hairbath","creator":"Innersense Organic Beauty","itemType":"product","price":0,"formattedPrice":"待核价","priceMode":"unknown","mainImage":"","secondaryImages":[],"aspectRatio":1,"category":"洗护","shortDescription":"Shampoo for medium to thick, dry and damaged hair","aiSummary":"Shampoo for medium to thick, dry and damaged hair；Scalp type: dry；Restores hydration and softness; smooths frizz and restores curl definition；Silicone-free; fragrance notes: sage and vanilla","reviews":[],"specs":{"市场":"US","产品类别":"洗发水","规格":"2 oz、10 oz、32 oz refill"},"composition":{"kind":"cosmetic-inci","status":"verified","region":"US","items":[{"name":"Water/Aqua/EAU","position":1,"normalizedName":"water/aqua/eau"},{"name":"Cocamidopropyl Hydroxysultaine","position":2,"normalizedName":"cocamidopropyl hydroxysultaine"},{"name":"Sodium Methyl Cocoyl Taurate","position":3,"normalizedName":"sodium methyl cocoyl taurate"},{"name":"Glycerin","position":4,"normalizedName":"glycerin"},{"name":"Caprylyl/Capryl Glucoside","position":5,"normalizedName":"caprylyl/capryl glucoside"},{"name":"Sodium Cocoyl Isethionate","position":6,"normalizedName":"sodium cocoyl isethionate"},{"name":"Glyceryl Stearate SE","position":7,"normalizedName":"glyceryl stearate se"},{"name":"Sodium Chloride","position":8,"normalizedName":"sodium chloride"},{"name":"Sodium Lauroyl Methyl Isethionate","position":9,"normalizedName":"sodium lauroyl methyl isethionate"},{"name":"Trisodium Ethylenediamine Disuccinate","position":10,"normalizedName":"trisodium ethylenediamine disuccinate"},{"name":"Guar Hydroxypropyltrimonium Chloride","position":11,"normalizedName":"guar hydroxypropyltrimonium chloride"},{"name":"Plumeria Acutifolia (Monoi) Flower Extract*","position":12,"normalizedName":"plumeria acutifolia (monoi) flower extract*"},{"name":"Cananga Odorata Flower Oil*","position":13,"normalizedName":"cananga odorata flower oil*"},{"name":"Lavandula Angustifolia (Lavender) Oil*","position":14,"normalizedName":"lavandula angustifolia (lavender) oil*"},{"name":"Citrus Aurantium Dulcis (Orange) Peel Oil*","position":15,"normalizedName":"citrus aurantium dulcis (orange) peel oil*"},{"name":"Salvia Sclarea (Clary) Oil","position":16,"normalizedName":"salvia sclarea (clary) oil"},{"name":"Vanillin","position":17,"normalizedName":"vanillin"},{"name":"Pogostemon Cablin Oil","position":18,"normalizedName":"pogostemon cablin oil"},{"name":"Glycine Soja (Soybean) Oil","position":19,"normalizedName":"glycine soja (soybean) oil"},{"name":"Sodium Benzoate","position":20,"normalizedName":"sodium benzoate"},{"name":"Pyrus Malus (Apple) Fruit Extract","position":21,"normalizedName":"pyrus malus (apple) fruit extract"},{"name":"Potassium Sorbate","position":22,"normalizedName":"potassium sorbate"},{"name":"Simmondsia Chinensis (Jojoba) Seed Oil*","position":23,"normalizedName":"simmondsia chinensis (jojoba) seed oil*"},{"name":"Oryza Sativa (Rice) Extract*","position":24,"normalizedName":"oryza sativa (rice) extract*"},{"name":"Citric Acid","position":25,"normalizedName":"citric acid"},{"name":"Hydrolyzed Quinoa","position":26,"normalizedName":"hydrolyzed quinoa"},{"name":"Hydrolyzed Rice Protein","position":27,"normalizedName":"hydrolyzed rice protein"},{"name":"Calophyllum Inophyllum (Tamanu) Oil*","position":28,"normalizedName":"calophyllum inophyllum (tamanu) oil*"},{"name":"Butyrospermum Parkii (Shea Butter)*","position":29,"normalizedName":"butyrospermum parkii (shea butter)*"},{"name":"Persia Gratissima (Avocado) Oil","position":30,"normalizedName":"persia gratissima (avocado) oil"},{"name":"Taraxacum Officinale (Dandelion) Leaf Extract","position":31,"normalizedName":"taraxacum officinale (dandelion) leaf extract"},{"name":"Salvia Officinalis (Sage) Leaf Extract","position":32,"normalizedName":"salvia officinalis (sage) leaf extract"},{"name":"Melissa Officinalis Leaf Extract","position":33,"normalizedName":"melissa officinalis leaf extract"},{"name":"Linalool†","position":34,"normalizedName":"linalool†"},{"name":"Limonene†","position":35,"normalizedName":"limonene†"}],"rawText":"Water/Aqua/EAU, Cocamidopropyl Hydroxysultaine, Sodium Methyl Cocoyl Taurate, Glycerin, Caprylyl/Capryl Glucoside, Sodium Cocoyl Isethionate, Glyceryl Stearate SE, Sodium Chloride, Sodium Lauroyl Methyl Isethionate, Trisodium Ethylenediamine Disuccinate, Guar Hydroxypropyltrimonium Chloride, Plumeria Acutifolia (Monoi) Flower Extract*, Cananga Odorata Flower Oil*, Lavandula Angustifolia (Lavender) Oil*, Citrus Aurantium Dulcis (Orange) Peel Oil*, Salvia Sclarea (Clary) Oil, Vanillin, Pogostemon Cablin Oil, Glycine Soja (Soybean) Oil, Sodium Benzoate, Pyrus Malus (Apple) Fruit Extract, Potassium Sorbate, Simmondsia Chinensis (Jojoba) Seed Oil*, Oryza Sativa (Rice) Extract*, Citric Acid, Hydrolyzed Quinoa, Hydrolyzed Rice Protein, Calophyllum Inophyllum (Tamanu) Oil*, Butyrospermum Parkii (Shea Butter)*, Persia Gratissima (Avocado) Oil, Taraxacum Officinale (Dandelion) Leaf Extract, Salvia Officinalis (Sage) Leaf Extract, Melissa Officinalis Leaf Extract, Linalool†, Limonene†","sourceUrl":"https://innersensebeauty.com/collections/build-up-dandruff/products/hydrating-cream-hairbath","verifiedAt":"2026-11-22"},"storeName":"Innersense Organic Beauty","sourceUrl":"https://innersensebeauty.com/collections/build-up-dandruff/products/hydrating-cream-hairbath","sourceDate":"2026-11-22","recommendationFacets":{"hairTypes":["medium-to-thick","dry-or-damaged"],"scalpNeeds":["dry"],"hairGoals":["减少毛躁"],"bodySkinNeeds":[],"bodySkinGoals":[],"formulaClaims":["无硅油"]},"formulaFacts":{"fragranceIngredientsListed":true,"slsSlesListed":false,"proteinIngredientListed":true},"manufacturerClaims":["Shampoo for medium to thick, dry and damaged hair","Scalp type: dry","Restores hydration and softness; smooths frizz and restores curl definition","Silicone-free; fragrance notes: sage and vanilla"],"productType":"shampoo","formulaMarket":"US","packagingVariants":["2 oz","10 oz","32 oz refill"],"source":{"kind":"brand_official_product_page","url":"https://innersensebeauty.com/collections/build-up-dandruff/products/hydrating-cream-hairbath","verifiedAt":"2026-11-22"},"catalogEvidence":{"sourceType":"official_store","reviewedAt":"2026-11-22","productPageStatus":"fetched","listingUrl":"https://innersensebeauty.com/collections/build-up-dandruff/products/hydrating-cream-hairbath","priceStatus":"unconfirmed","stockStatus":"unknown","deliveryToChina":"unverified","checkoutVerified":false,"imageStatus":"source_url_only"},"notes":"配方拼写按品牌页面保留，包括 Persia Gratissima；页面显示的 INCI 不应被视为临床适用结论。"}'::jsonb,
    'sample',
    '2026-11-22T00:00:00Z'::timestamptz,
    false,
    true
  );
  perform public.upsert_consumer_catalog_product(
    'https://www.vanicream.com/product/free-and-clear-conditioner',
    '{"id":"vanicream-conditioner-us","name":"Vanicream Conditioner","creator":"Vanicream","itemType":"product","price":0,"formattedPrice":"待核价","priceMode":"unknown","mainImage":"","secondaryImages":[],"aspectRatio":1,"category":"洗护","shortDescription":"Helps prevent tangles; leaves hair manageable and adds body and volume","aiSummary":"Helps prevent tangles; leaves hair manageable and adds body and volume；Fragrance-free, gluten-free and protein-free；No botanical extracts or essential oils; pH balanced","reviews":[],"specs":{"市场":"US","产品类别":"护发素","规格":"2 oz、12 oz"},"composition":{"kind":"cosmetic-inci","status":"verified","region":"US","items":[{"name":"water","position":1,"normalizedName":"water"},{"name":"cetearyl alcohol","position":2,"normalizedName":"cetearyl alcohol"},{"name":"hydrogenated polydecene","position":3,"normalizedName":"hydrogenated polydecene"},{"name":"propanediol","position":4,"normalizedName":"propanediol"},{"name":"distearoylethyl dimonium chloride","position":5,"normalizedName":"distearoylethyl dimonium chloride"},{"name":"glycerin","position":6,"normalizedName":"glycerin"},{"name":"ceteareth-20","position":7,"normalizedName":"ceteareth-20"},{"name":"panthenol","position":8,"normalizedName":"panthenol"},{"name":"1,2-hexanediol","position":9,"normalizedName":"1,2-hexanediol"},{"name":"arginine","position":10,"normalizedName":"arginine"},{"name":"caprylyl glycol","position":11,"normalizedName":"caprylyl glycol"}],"rawText":"water, cetearyl alcohol, hydrogenated polydecene, propanediol, distearoylethyl dimonium chloride, glycerin, ceteareth-20, panthenol, 1,2-hexanediol, arginine, caprylyl glycol","sourceUrl":"https://www.vanicream.com/product/free-and-clear-conditioner","verifiedAt":"2026-11-22"},"storeName":"Vanicream","sourceUrl":"https://www.vanicream.com/product/free-and-clear-conditioner","sourceDate":"2026-11-22","recommendationFacets":{"hairTypes":[],"scalpNeeds":[],"hairGoals":["柔顺少打结","更蓬松"],"bodySkinNeeds":[],"bodySkinGoals":[],"formulaClaims":["无香精","无蛋白质","无植物提取物和精油"]},"formulaFacts":{"fragranceIngredientsListed":false,"slsSlesListed":false,"proteinIngredientListed":false},"manufacturerClaims":["Helps prevent tangles; leaves hair manageable and adds body and volume","Fragrance-free, gluten-free and protein-free","No botanical extracts or essential oils; pH balanced"],"productType":"conditioner","formulaMarket":"US","packagingVariants":["2 oz","12 oz"],"source":{"kind":"brand_official_product_page","url":"https://www.vanicream.com/product/free-and-clear-conditioner","verifiedAt":"2026-11-22"},"catalogEvidence":{"sourceType":"official_store","reviewedAt":"2026-11-22","productPageStatus":"fetched","listingUrl":"https://www.vanicream.com/product/free-and-clear-conditioner","priceStatus":"unconfirmed","stockStatus":"unknown","deliveryToChina":"unverified","checkoutVerified":false,"imageStatus":"source_url_only"}}'::jsonb,
    'sample',
    '2026-11-22T00:00:00Z'::timestamptz,
    false,
    true
  );
  perform public.upsert_consumer_catalog_product(
    'https://innersensebeauty.com/collections/travel/products/hydrating-cream-conditioner',
    '{"id":"innersense-hydrating-cream-conditioner-us","name":"Hydrating Cream Conditioner","creator":"Innersense Organic Beauty","itemType":"product","price":0,"formattedPrice":"待核价","priceMode":"unknown","mainImage":"","secondaryImages":[],"aspectRatio":1,"category":"洗护","shortDescription":"Conditioner for dry and damaged hair; best for coarse, damaged or thirsty hair","aiSummary":"Conditioner for dry and damaged hair; best for coarse, damaged or thirsty hair；Restores moisture and shine; helps control frizz；Silicone-free; fragrance notes: sage and vanilla","reviews":[],"specs":{"市场":"US","产品类别":"护发素","规格":"2 oz、10 oz、32 oz refill"},"composition":{"kind":"cosmetic-inci","status":"verified","region":"US","items":[{"name":"Water/Aqua/EAU","position":1,"normalizedName":"water/aqua/eau"},{"name":"Cetearyl Alcohol","position":2,"normalizedName":"cetearyl alcohol"},{"name":"Glycerin","position":3,"normalizedName":"glycerin"},{"name":"Behentrimonium Methosulfate","position":4,"normalizedName":"behentrimonium methosulfate"},{"name":"Aloe Barbadensis (Aloe Vera) Leaf Gel*","position":5,"normalizedName":"aloe barbadensis (aloe vera) leaf gel*"},{"name":"Stearalkonium Chloride","position":6,"normalizedName":"stearalkonium chloride"},{"name":"Diheptyl Succinate","position":7,"normalizedName":"diheptyl succinate"},{"name":"Capryloyl Glycerin","position":8,"normalizedName":"capryloyl glycerin"},{"name":"Cocos Nucifera*","position":9,"normalizedName":"cocos nucifera*"},{"name":"Cananga Odorata Flower Oil","position":10,"normalizedName":"cananga odorata flower oil"},{"name":"Lavandula Angustifolia (Lavender) Oil*","position":11,"normalizedName":"lavandula angustifolia (lavender) oil*"},{"name":"Citrus Aurantium Dulcis (Orange) Peel Oil*","position":12,"normalizedName":"citrus aurantium dulcis (orange) peel oil*"},{"name":"Salvia Sclarea (Clary) Oil","position":13,"normalizedName":"salvia sclarea (clary) oil"},{"name":"Vanillin","position":14,"normalizedName":"vanillin"},{"name":"Pogostemon Cablin Oil","position":15,"normalizedName":"pogostemon cablin oil"},{"name":"Glycine Soja (Soybean) Oil","position":16,"normalizedName":"glycine soja (soybean) oil"},{"name":"Cocos Nucifera (Coconut) Oil*","position":17,"normalizedName":"cocos nucifera (coconut) oil*"},{"name":"Sodium Benzoate","position":18,"normalizedName":"sodium benzoate"},{"name":"Oryza Sativa (Rice) Extract*","position":19,"normalizedName":"oryza sativa (rice) extract*"},{"name":"Theobroma Cacao (Cocoa) Seed Butter*","position":20,"normalizedName":"theobroma cacao (cocoa) seed butter*"},{"name":"Potassium Sorbate","position":21,"normalizedName":"potassium sorbate"},{"name":"Guar Hydroxypropyltrimonium Chloride","position":22,"normalizedName":"guar hydroxypropyltrimonium chloride"},{"name":"Citric Acid","position":23,"normalizedName":"citric acid"},{"name":"Cetyl Hydroxyethylcellulose","position":24,"normalizedName":"cetyl hydroxyethylcellulose"},{"name":"Linum Usitatissimum (Linseed) Seed Oil","position":25,"normalizedName":"linum usitatissimum (linseed) seed oil"},{"name":"Calophyllum Inophyllum (Tamanu) Oil*","position":26,"normalizedName":"calophyllum inophyllum (tamanu) oil*"},{"name":"Hydrolyzed Rice Protein","position":27,"normalizedName":"hydrolyzed rice protein"},{"name":"Plumeria Acutifolia (Monoi) Flower Extract","position":28,"normalizedName":"plumeria acutifolia (monoi) flower extract"},{"name":"Persea Gratissima (Avocado) Oil*","position":29,"normalizedName":"persea gratissima (avocado) oil*"},{"name":"Butyrospermum Parkii (Shea Butter)*","position":30,"normalizedName":"butyrospermum parkii (shea butter)*"},{"name":"Simmondsia Chinensis (Jojoba) Seed Oil*","position":31,"normalizedName":"simmondsia chinensis (jojoba) seed oil*"},{"name":"Hydrolyzed Quinoa","position":32,"normalizedName":"hydrolyzed quinoa"},{"name":"Benzyl Alcohol","position":33,"normalizedName":"benzyl alcohol"},{"name":"Taraxacum Officinale (Dandelion) Leaf Extract","position":34,"normalizedName":"taraxacum officinale (dandelion) leaf extract"},{"name":"Salvia Officinalis (Sage) Leaf Extract","position":35,"normalizedName":"salvia officinalis (sage) leaf extract"},{"name":"Melissa Officinalis Leaf Extract","position":36,"normalizedName":"melissa officinalis leaf extract"},{"name":"Linalool†","position":37,"normalizedName":"linalool†"},{"name":"Limonene†","position":38,"normalizedName":"limonene†"}],"rawText":"Water/Aqua/EAU, Cetearyl Alcohol, Glycerin, Behentrimonium Methosulfate, Aloe Barbadensis (Aloe Vera) Leaf Gel*, Stearalkonium Chloride, Diheptyl Succinate, Capryloyl Glycerin, Cocos Nucifera*, Cananga Odorata Flower Oil, Lavandula Angustifolia (Lavender) Oil*, Citrus Aurantium Dulcis (Orange) Peel Oil*, Salvia Sclarea (Clary) Oil, Vanillin, Pogostemon Cablin Oil, Glycine Soja (Soybean) Oil, Cocos Nucifera (Coconut) Oil*, Sodium Benzoate, Oryza Sativa (Rice) Extract*, Theobroma Cacao (Cocoa) Seed Butter*, Potassium Sorbate, Guar Hydroxypropyltrimonium Chloride, Citric Acid, Cetyl Hydroxyethylcellulose, Linum Usitatissimum (Linseed) Seed Oil, Calophyllum Inophyllum (Tamanu) Oil*, Hydrolyzed Rice Protein, Plumeria Acutifolia (Monoi) Flower Extract, Persea Gratissima (Avocado) Oil*, Butyrospermum Parkii (Shea Butter)*, Simmondsia Chinensis (Jojoba) Seed Oil*, Hydrolyzed Quinoa, Benzyl Alcohol, Taraxacum Officinale (Dandelion) Leaf Extract, Salvia Officinalis (Sage) Leaf Extract, Melissa Officinalis Leaf Extract, Linalool†, Limonene†","sourceUrl":"https://innersensebeauty.com/collections/travel/products/hydrating-cream-conditioner","verifiedAt":"2026-11-22"},"storeName":"Innersense Organic Beauty","sourceUrl":"https://innersensebeauty.com/collections/travel/products/hydrating-cream-conditioner","sourceDate":"2026-11-22","recommendationFacets":{"hairTypes":["coarse","dry-or-damaged"],"scalpNeeds":[],"hairGoals":["减少毛躁"],"bodySkinNeeds":[],"bodySkinGoals":[],"formulaClaims":["无硅油"]},"formulaFacts":{"fragranceIngredientsListed":true,"slsSlesListed":false,"proteinIngredientListed":true},"manufacturerClaims":["Conditioner for dry and damaged hair; best for coarse, damaged or thirsty hair","Restores moisture and shine; helps control frizz","Silicone-free; fragrance notes: sage and vanilla"],"productType":"conditioner","formulaMarket":"US","packagingVariants":["2 oz","10 oz","32 oz refill"],"source":{"kind":"brand_official_product_page","url":"https://innersensebeauty.com/collections/travel/products/hydrating-cream-conditioner","verifiedAt":"2026-11-22"},"catalogEvidence":{"sourceType":"official_store","reviewedAt":"2026-11-22","productPageStatus":"fetched","listingUrl":"https://innersensebeauty.com/collections/travel/products/hydrating-cream-conditioner","priceStatus":"unconfirmed","stockStatus":"unknown","deliveryToChina":"unverified","checkoutVerified":false,"imageStatus":"source_url_only"},"notes":"Behentrimonium Methosulfate 按 INCI 原名记录，不将名称含 methosulfate 等同于 SLS/SLES 清洁表活。"}'::jsonb,
    'sample',
    '2026-11-22T00:00:00Z'::timestamptz,
    false,
    true
  );
  perform public.upsert_consumer_catalog_product(
    'https://www.dove.com/us/en/p/ultra-sensitive-body-wash.html/00011111049444',
    '{"id":"dove-ultra-sensitive-body-wash-us","name":"Ultra Sensitive Serum Body Wash","creator":"Dove","itemType":"product","price":0,"formattedPrice":"待核价","priceMode":"unknown","mainImage":"","secondaryImages":[],"aspectRatio":1,"category":"洗护","shortDescription":"Fragrance-free body wash for ultra-sensitive skin","aiSummary":"Fragrance-free body wash for ultra-sensitive skin；Sulfate-free and paraben-free；Formulated with 10 ingredients","reviews":[],"specs":{"市场":"US","产品类别":"沐浴露","规格":"18.5 oz / 547 mL"},"composition":{"kind":"cosmetic-inci","status":"verified","region":"US","items":[{"name":"Water (Aqua)","position":1,"normalizedName":"water (aqua)"},{"name":"Cocamidopropyl Betaine","position":2,"normalizedName":"cocamidopropyl betaine"},{"name":"Sodium Methyl Lauroyl Taurate","position":3,"normalizedName":"sodium methyl lauroyl taurate"},{"name":"Sodium Chloride","position":4,"normalizedName":"sodium chloride"},{"name":"Glycerin","position":5,"normalizedName":"glycerin"},{"name":"Hydroxystearic Acid","position":6,"normalizedName":"hydroxystearic acid"},{"name":"Stearic Acid","position":7,"normalizedName":"stearic acid"},{"name":"Cocamide MEA","position":8,"normalizedName":"cocamide mea"},{"name":"Sodium Benzoate","position":9,"normalizedName":"sodium benzoate"},{"name":"Citric Acid","position":10,"normalizedName":"citric acid"}],"rawText":"Water (Aqua), Cocamidopropyl Betaine, Sodium Methyl Lauroyl Taurate, Sodium Chloride, Glycerin, Hydroxystearic Acid, Stearic Acid, Cocamide MEA, Sodium Benzoate, Citric Acid","sourceUrl":"https://www.dove.com/us/en/p/ultra-sensitive-body-wash.html/00011111049444","verifiedAt":"2026-11-22"},"storeName":"Dove","sourceUrl":"https://www.dove.com/us/en/p/ultra-sensitive-body-wash.html/00011111049444","sourceDate":"2026-11-22","recommendationFacets":{"hairTypes":[],"scalpNeeds":[],"hairGoals":[],"bodySkinNeeds":["ultra-sensitive"],"bodySkinGoals":["保湿与舒适"],"formulaClaims":["无香精","无 SLS/SLES","无 Paraben"]},"formulaFacts":{"fragranceIngredientsListed":false,"slsSlesListed":false,"proteinIngredientListed":false},"manufacturerClaims":["Fragrance-free body wash for ultra-sensitive skin","Sulfate-free and paraben-free","Formulated with 10 ingredients"],"productType":"body-wash","formulaMarket":"US","packagingVariants":["18.5 oz / 547 mL"],"source":{"kind":"brand_official_product_page","url":"https://www.dove.com/us/en/p/ultra-sensitive-body-wash.html/00011111049444","verifiedAt":"2026-11-22"},"catalogEvidence":{"sourceType":"official_store","reviewedAt":"2026-11-22","productPageStatus":"fetched","listingUrl":"https://www.dove.com/us/en/p/ultra-sensitive-body-wash.html/00011111049444","priceStatus":"unconfirmed","stockStatus":"unknown","deliveryToChina":"unverified","checkoutVerified":false,"imageStatus":"source_url_only"}}'::jsonb,
    'sample',
    '2026-11-22T00:00:00Z'::timestamptz,
    false,
    true
  );
  perform public.upsert_consumer_catalog_product(
    'https://www.aveeno.com/products/daily-moisturizing-body-wash-with-prebiotic-oat',
    '{"id":"aveeno-daily-moisturizing-body-wash-us","name":"Daily Moisturizing Body Wash, Light Fragrance","creator":"Aveeno","itemType":"product","price":0,"formattedPrice":"待核价","priceMode":"unknown","mainImage":"","secondaryImages":[],"aspectRatio":1,"category":"洗护","shortDescription":"For normal to dry and sensitive skin","aiSummary":"For normal to dry and sensitive skin；Helps dry, sensitive skin feel moisturized; contains prebiotic oat；Light fragrance; formulated without parabens, dyes and soaps","reviews":[],"specs":{"市场":"US","产品类别":"沐浴露","规格":"2 oz、12 oz、18 oz、33 oz、33 oz 2-pack"},"composition":{"kind":"cosmetic-inci","status":"verified","region":"US","items":[{"name":"Water","position":1,"normalizedName":"water"},{"name":"Glycerin","position":2,"normalizedName":"glycerin"},{"name":"Cocamidopropyl Betaine","position":3,"normalizedName":"cocamidopropyl betaine"},{"name":"Sodium Laureth Sulfate","position":4,"normalizedName":"sodium laureth sulfate"},{"name":"Avena Sativa (Oat) Kernel Flour","position":5,"normalizedName":"avena sativa (oat) kernel flour"},{"name":"Avena Sativa (Oat) Kernel Oil","position":6,"normalizedName":"avena sativa (oat) kernel oil"},{"name":"Avena Sativa (Oat) Kernel Extract","position":7,"normalizedName":"avena sativa (oat) kernel extract"},{"name":"Guar Hydroxypropyltrimonium Chloride","position":8,"normalizedName":"guar hydroxypropyltrimonium chloride"},{"name":"Polyquaternium-10","position":9,"normalizedName":"polyquaternium-10"},{"name":"Testrasodium Edta","position":10,"normalizedName":"testrasodium edta"},{"name":"Sodium Benzoate","position":11,"normalizedName":"sodium benzoate"},{"name":"Citric Acid","position":12,"normalizedName":"citric acid"},{"name":"Sodium Hydroxide","position":13,"normalizedName":"sodium hydroxide"},{"name":"Fragrance","position":14,"normalizedName":"fragrance"}],"rawText":"Water, Glycerin, Cocamidopropyl Betaine, Sodium Laureth Sulfate, Avena Sativa (Oat) Kernel Flour, Avena Sativa (Oat) Kernel Oil, Avena Sativa (Oat) Kernel Extract, Guar Hydroxypropyltrimonium Chloride, Polyquaternium-10, Testrasodium Edta, Sodium Benzoate, Citric Acid, Sodium Hydroxide, Fragrance","sourceUrl":"https://www.aveeno.com/products/daily-moisturizing-body-wash-with-prebiotic-oat","verifiedAt":"2026-11-22"},"storeName":"Aveeno","sourceUrl":"https://www.aveeno.com/products/daily-moisturizing-body-wash-with-prebiotic-oat","sourceDate":"2026-11-22","recommendationFacets":{"hairTypes":[],"scalpNeeds":[],"hairGoals":[],"bodySkinNeeds":["dry","sensitive"],"bodySkinGoals":["保湿与舒适"],"formulaClaims":["含燕麦","含香精","含 SLS/SLES","无 Paraben","无染料","无皂"]},"formulaFacts":{"fragranceIngredientsListed":true,"slsSlesListed":true,"proteinIngredientListed":false},"manufacturerClaims":["For normal to dry and sensitive skin","Helps dry, sensitive skin feel moisturized; contains prebiotic oat","Light fragrance; formulated without parabens, dyes and soaps"],"productType":"body-wash","formulaMarket":"US","packagingVariants":["2 oz","12 oz","18 oz","33 oz","33 oz 2-pack"],"source":{"kind":"brand_official_product_page","url":"https://www.aveeno.com/products/daily-moisturizing-body-wash-with-prebiotic-oat","verifiedAt":"2026-11-22"},"catalogEvidence":{"sourceType":"official_store","reviewedAt":"2026-11-22","productPageStatus":"fetched","listingUrl":"https://www.aveeno.com/products/daily-moisturizing-body-wash-with-prebiotic-oat","priceStatus":"unconfirmed","stockStatus":"unknown","deliveryToChina":"unverified","checkoutVerified":false,"imageStatus":"source_url_only"},"notes":"官网成分表将 Tetrasodium EDTA 显示为 Testrasodium Edta，按页面原拼写保存；实际使用前应以对应规格包装标签复核。"}'::jsonb,
    'sample',
    '2026-11-22T00:00:00Z'::timestamptz,
    false,
    true
  );
END;
$wash_care_seed$;


commit;
