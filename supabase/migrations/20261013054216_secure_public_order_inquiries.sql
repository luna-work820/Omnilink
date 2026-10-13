-- Public checkout may submit an inquiry, but callers must not write prices,
-- order totals, or order lines directly through the Data API.
revoke insert on public.orders, public.order_items from anon, authenticated;

create or replace function public.submit_storefront_inquiry(
  p_order_id uuid,
  p_order_number text,
  p_store_slug text,
  p_customer jsonb,
  p_items jsonb
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store record;
  v_channel_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_product record;
  v_quantity integer;
  v_subtotal numeric(14, 2) := 0;
  v_item_total numeric(14, 2);
  v_count integer := 0;
  v_options jsonb;
begin
  if p_order_id is null
     or p_order_number is null
     or length(p_order_number) > 80
     or p_store_slug is null
     or jsonb_typeof(p_customer) is distinct from 'object'
     or jsonb_typeof(p_items) is distinct from 'array'
     or pg_column_size(p_customer) > 8192
     or pg_column_size(p_items) > 32768
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 30 then
    raise exception 'Invalid inquiry payload';
  end if;

  if length(btrim(coalesce(p_customer->>'name', ''))) not between 1 and 200
     or length(btrim(coalesce(p_customer->>'email', ''))) not between 3 and 320
     or position('@' in (p_customer->>'email')) < 2 then
    raise exception 'Customer name and email are required';
  end if;

  if exists (
    select 1
    from jsonb_each_text(p_customer) entry
    where length(entry.value) > 2000
  ) then
    raise exception 'Customer field is too long';
  end if;

  select s.id, s.organization_id, s.currency
    into v_store
  from public.stores s
  where s.slug = p_store_slug
    and s.status = 'active'
  limit 1;

  if v_store.id is null then
    raise exception 'Store not found';
  end if;

  if not (
    exists (
      select 1 from public.storefronts sf
      where sf.store_id = v_store.id
        and sf.status = 'published'
        and sf.published_version_id is not null
    )
    or exists (
      select 1 from public.store_pages sp
      where sp.store_id = v_store.id and sp.published = true
    )
  ) then
    raise exception 'Store is not published';
  end if;

  select sc.id into v_channel_id
  from public.sales_channels sc
  where sc.organization_id = v_store.organization_id
    and sc.code = 'storefront'
    and sc.channel_type = 'storefront'
    and sc.status = 'active'
  limit 1;

  if v_channel_id is null then
    raise exception 'Storefront inquiries are disabled';
  end if;

  insert into public.orders (
    id, store_id, order_number, customer_name, customer_email,
    customer_phone, customer_whatsapp, company, country, state, city,
    address, notes, contact_preference, currency, subtotal, status
  ) values (
    p_order_id,
    v_store.id,
    p_order_number,
    btrim(p_customer->>'name'),
    btrim(p_customer->>'email'),
    nullif(btrim(p_customer->>'phone'), ''),
    nullif(btrim(p_customer->>'whatsapp'), ''),
    nullif(btrim(p_customer->>'company'), ''),
    nullif(btrim(p_customer->>'country'), ''),
    nullif(btrim(p_customer->>'state'), ''),
    nullif(btrim(p_customer->>'city'), ''),
    nullif(btrim(p_customer->>'address'), ''),
    nullif(btrim(p_customer->>'notes'), ''),
    case when p_customer->>'contactPreference' in ('email', 'phone', 'whatsapp')
      then p_customer->>'contactPreference' else 'email' end,
    coalesce(v_store.currency, 'USD'),
    0,
    'inquiry_pending'
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_count := v_count + 1;
    if jsonb_typeof(v_item) is distinct from 'object'
       or coalesce(v_item->>'productId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Invalid product selection';
    end if;

    v_product_id := (v_item->>'productId')::uuid;
    v_quantity := coalesce((v_item->>'quantity')::integer, 1);
    if v_quantity < 1 or v_quantity > 100 then
      raise exception 'Invalid quantity';
    end if;

    if nullif(v_item->>'variantId', '') is not null then
      if (v_item->>'variantId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Invalid product option';
      end if;
      v_variant_id := (v_item->>'variantId')::uuid;
    else
      v_variant_id := null;
    end if;

    select ci.title, cv.id as variant_id, cv.sku_code, cv.price, cv.currency_code
      into v_product
    from public.catalog_items ci
    join public.catalog_variants cv
      on cv.catalog_item_id = ci.id
     and cv.organization_id = ci.organization_id
    join public.catalog_item_channels cic
      on cic.catalog_item_id = ci.id
     and cic.organization_id = ci.organization_id
     and cic.store_id = v_store.id
     and cic.channel_id = v_channel_id
     and cic.is_visible = true
    where ci.id = v_product_id
      and ci.organization_id = v_store.organization_id
      and ci.status = 'active'
      and (v_variant_id is null or cv.id = v_variant_id)
    order by cv.created_at, cv.id
    limit 1;

    if v_product.variant_id is null then
      raise exception 'Selected product or option is unavailable';
    end if;

    v_item_total := v_product.price * v_quantity;
    v_subtotal := v_subtotal + v_item_total;
    v_options := case
      when jsonb_typeof(v_item->'selectedOptions') = 'object'
       and pg_column_size(v_item->'selectedOptions') <= 4096
        then v_item->'selectedOptions'
      else '{}'::jsonb
    end;

    insert into public.order_items (
      id, order_id, product_id, variant_id, product_name_snapshot,
      sku_snapshot, quantity, unit_price_snapshot, currency, selected_options
    ) values (
      gen_random_uuid(), p_order_id, v_product_id, v_product.variant_id,
      v_product.title, v_product.sku_code, v_quantity, v_product.price,
      coalesce(v_product.currency_code, v_store.currency, 'USD'), v_options
    );
  end loop;

  update public.orders o
  set subtotal = v_subtotal
  where o.id = p_order_id;

  return query select p_order_id, p_order_number;
end;
$$;

revoke all on function public.submit_storefront_inquiry(uuid, text, text, jsonb, jsonb)
  from public;
grant execute on function public.submit_storefront_inquiry(uuid, text, text, jsonb, jsonb)
  to anon, authenticated;

-- Confirmation is read through the same opaque order UUID returned by submit.
-- The store slug is part of the capability check so an ID cannot be used
-- across storefronts, and only the customer-facing snapshot is returned.
create or replace function public.get_public_order_confirmation(
  p_store_slug text,
  p_order_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'storeId', s.id,
    'storeSlug', s.slug,
    'storeName', s.name,
    'customer', jsonb_build_object(
      'name', o.customer_name,
      'email', o.customer_email,
      'phone', o.customer_phone,
      'whatsapp', o.customer_whatsapp,
      'company', o.company,
      'country', o.country,
      'state', o.state,
      'city', o.city,
      'address', o.address,
      'notes', o.notes,
      'contactPreference', o.contact_preference
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'productId', oi.product_id,
        'variantId', oi.variant_id,
        'productName', oi.product_name_snapshot,
        'sku', oi.sku_snapshot,
        'quantity', oi.quantity,
        'unitPrice', oi.unit_price_snapshot,
        'currency', oi.currency,
        'selectedOptions', oi.selected_options,
        'subtotal', oi.unit_price_snapshot * oi.quantity
      ) order by oi.created_at, oi.id)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    'currency', o.currency,
    'subtotal', o.subtotal,
    'status', o.status,
    'createdAt', o.created_at,
    'storeContact', coalesce(
      ss.theme_config #> '{globalInfo,contact}',
      ss.theme_config -> 'contact'
    )
  )
  from public.orders o
  join public.stores s on s.id = o.store_id
  left join public.store_settings ss on ss.store_id = s.id
  where o.id = p_order_id
    and s.slug = p_store_slug
  limit 1;
$$;

revoke all on function public.get_public_order_confirmation(text, uuid)
  from public;
grant execute on function public.get_public_order_confirmation(text, uuid)
  to anon, authenticated;
