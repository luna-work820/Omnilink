-- Single transaction for attribute-definition creation, value writes and
-- deletions. SECURITY INVOKER keeps the caller's RLS policies in force.
create or replace function public.save_catalog_item_attributes(
  p_item_id uuid,
  p_attributes jsonb default '[]'::jsonb,
  p_deletions text[] default '{}',
  p_category_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_org_id uuid;
  v_attr jsonb;
  v_definition_id uuid;
  v_code text;
  v_label text;
  v_type text;
  v_variant_id uuid;
  v_value jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_attributes) <> 'array' then
    raise exception 'p_attributes must be a JSON array' using errcode = '22023';
  end if;

  select i.organization_id into v_org_id
  from public.catalog_items i
  where i.id = p_item_id;
  if v_org_id is null then
    raise exception 'Catalog item not found' using errcode = 'P0002';
  end if;
  if not private.is_org_member(v_org_id, array['owner','admin','editor']) then
    raise exception 'Not authorized to edit this catalog item' using errcode = '42501';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.catalog_categories c
    where c.id = p_category_id and c.organization_id = v_org_id
  ) then
    raise exception 'Category does not belong to this organization' using errcode = '23503';
  end if;

  -- Delete first; an explicit value in this request wins over a deletion key.
  if coalesce(cardinality(p_deletions), 0) > 0 then
    delete from public.catalog_item_attributes a
    using public.catalog_attribute_definitions d
    where a.definition_id = d.id
      and a.organization_id = v_org_id
      and a.catalog_item_id = p_item_id
      and a.variant_id is null
      and d.code = any(p_deletions);
  end if;

  for v_attr in select value from jsonb_array_elements(p_attributes)
  loop
    v_code := lower(btrim(v_attr->>'key'));
    if coalesce(v_code, '') = '' then
      raise exception 'Attribute key is required' using errcode = '22023';
    end if;
    v_label := coalesce(nullif(btrim(v_attr->>'label'), ''), v_code);
    v_type := case v_attr->>'type'
      when 'number' then 'number'
      when 'boolean' then 'boolean'
      when 'select' then 'enum'
      when 'date' then 'date'
      when 'url' then 'url'
      when 'json' then 'json'
      else 'text'
    end;
    v_variant_id := nullif(v_attr->>'variant_id', '')::uuid;

    if v_variant_id is not null and not exists (
      select 1 from public.catalog_variants v
      where v.id = v_variant_id
        and v.catalog_item_id = p_item_id
        and v.organization_id = v_org_id
    ) then
      raise exception 'Variant does not belong to this catalog item' using errcode = '23503';
    end if;

    if p_category_id is null then
      insert into public.catalog_attribute_definitions as d (
        organization_id, category_id, code, label, value_type, unit,
        is_required, options, updated_at
      ) values (
        v_org_id, p_category_id, v_code, v_label, v_type,
        nullif(v_attr->>'unit', ''), coalesce((v_attr->>'required')::boolean, false),
        case when jsonb_typeof(v_attr->'allowed_values') = 'array'
          then v_attr->'allowed_values' else '[]'::jsonb end,
        now()
      )
      on conflict (organization_id, code) where category_id is null
        do update set label = excluded.label, value_type = excluded.value_type,
          unit = excluded.unit, is_required = excluded.is_required,
          options = excluded.options, updated_at = now()
      returning id into v_definition_id;
    else
      insert into public.catalog_attribute_definitions as d (
        organization_id, category_id, code, label, value_type, unit,
        is_required, options, updated_at
      ) values (
        v_org_id, p_category_id, v_code, v_label, v_type,
        nullif(v_attr->>'unit', ''), coalesce((v_attr->>'required')::boolean, false),
        case when jsonb_typeof(v_attr->'allowed_values') = 'array'
          then v_attr->'allowed_values' else '[]'::jsonb end,
        now()
      )
      on conflict (organization_id, category_id, code) where category_id is not null
        do update set label = excluded.label, value_type = excluded.value_type,
          unit = excluded.unit, is_required = excluded.is_required,
          options = excluded.options, updated_at = now()
      returning id into v_definition_id;
    end if;

    v_value := coalesce(v_attr->'value', 'null'::jsonb);
    if v_type = 'number' and jsonb_typeof(v_value) = 'string' then
      v_value := to_jsonb((v_value #>> '{}')::numeric);
    elsif v_type = 'boolean' and jsonb_typeof(v_value) = 'string' then
      v_value := to_jsonb((v_value #>> '{}')::boolean);
    end if;

    if v_variant_id is null then
      insert into public.catalog_item_attributes as a (
        organization_id, catalog_item_id, definition_id, value, variant_id,
        value_origin, confidence, review_status, updated_at
      ) values (
        v_org_id, p_item_id, v_definition_id, v_value, null,
        coalesce(nullif(v_attr->>'source', ''), 'manual'),
        nullif(v_attr->>'confidence', '')::numeric,
        case when v_attr->>'source' = 'ai' then 'pending_review' else 'confirmed' end,
        now()
      )
      on conflict (organization_id, catalog_item_id, definition_id) where variant_id is null
        do update set value = excluded.value, value_origin = excluded.value_origin,
          confidence = excluded.confidence, review_status = excluded.review_status,
          updated_at = now();
    else
      insert into public.catalog_item_attributes as a (
        organization_id, catalog_item_id, definition_id, value, variant_id,
        value_origin, confidence, review_status, updated_at
      ) values (
        v_org_id, p_item_id, v_definition_id, v_value, v_variant_id,
        coalesce(nullif(v_attr->>'source', ''), 'manual'),
        nullif(v_attr->>'confidence', '')::numeric,
        case when v_attr->>'source' = 'ai' then 'pending_review' else 'confirmed' end,
        now()
      )
      on conflict (organization_id, catalog_item_id, variant_id, definition_id) where variant_id is not null
        do update set value = excluded.value, value_origin = excluded.value_origin,
          confidence = excluded.confidence, review_status = excluded.review_status,
          updated_at = now();
    end if;
  end loop;
end;
$$;

revoke all on function public.save_catalog_item_attributes(uuid, jsonb, text[], uuid) from public, anon;
grant execute on function public.save_catalog_item_attributes(uuid, jsonb, text[], uuid) to authenticated;
