-- ============================================================================
-- Migration: 20260908_000001_create_order_system.sql
--
-- Purpose: Create secure order system with atomic transactions and access token
--          based on current Omnilink checkout requirements.
--
-- Security Principles:
--   - No public SELECT policies (customers access via server action with token)
--   - Merchant access limited to own store via RLS
--   - High-entropy access tokens for anonymous customer access
--   - Atomic order + order_items creation via RPC
-- ============================================================================

-- ============================================================================
-- 1. Orders Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Store relationship
  store_id uuid NOT NULL 
    REFERENCES public.stores(id) 
    ON DELETE RESTRICT,
  
  -- Order metadata
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'inquiry_pending',
  currency text NOT NULL DEFAULT 'USD',
  
  -- Customer information (from current checkout UI)
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  customer_whatsapp text,
  company text,
  country text,
  state text,
  city text,
  address text,
  notes text,
  contact_preference text DEFAULT 'email',
  
  -- Pricing (server-calculated only)
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  
  -- Security: access token for anonymous customer order access
  customer_access_token text NOT NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT orders_status_check 
    CHECK (status IN ('inquiry_pending', 'confirmed', 'cancelled')),
  
  CONSTRAINT orders_subtotal_nonnegative
    CHECK (subtotal >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_access_token 
  ON public.orders(customer_access_token);

-- ============================================================================
-- 2. Order Items Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Order relationship
  order_id uuid NOT NULL 
    REFERENCES public.orders(id) 
    ON DELETE CASCADE,
  
  -- Product relationships
  product_id uuid NOT NULL 
    REFERENCES public.products(id) 
    ON DELETE RESTRICT,
  
  variant_id uuid 
    REFERENCES public.product_variants(id) 
    ON DELETE RESTRICT,
  
  -- Snapshots (preserve order-time data)
  product_name_snapshot text NOT NULL,
  sku_snapshot text,
  variant_snapshot jsonb DEFAULT '{}',
  
  -- Quantity and pricing
  quantity integer NOT NULL,
  unit_price_snapshot numeric(12,2) NOT NULL,
  line_total numeric(12,2) NOT NULL,
  
  -- Timestamp
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT order_items_quantity_positive
    CHECK (quantity > 0),
  
  CONSTRAINT order_items_price_nonnegative
    CHECK (unit_price_snapshot >= 0 AND line_total >= 0)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- ============================================================================
-- 3. RLS Enable
-- ============================================================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Merchant RLS Policies
-- ============================================================================

-- Merchants can view orders from their own stores
DROP POLICY IF EXISTS "Merchant can view own store orders" ON public.orders;
CREATE POLICY "Merchant can view own store orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = orders.store_id
        AND s.owner_id = auth.uid()
    )
  );

-- Merchants can update orders from their own stores
DROP POLICY IF EXISTS "Merchant can update own store orders" ON public.orders;
CREATE POLICY "Merchant can update own store orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = orders.store_id
        AND s.owner_id = auth.uid()
    )
  );

-- Merchants can delete orders from their own stores
DROP POLICY IF EXISTS "Merchant can delete own store orders" ON public.orders;
CREATE POLICY "Merchant can delete own store orders"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.id = orders.store_id
        AND s.owner_id = auth.uid()
    )
  );

-- Merchants can view order items from their own stores
DROP POLICY IF EXISTS "Merchant can view own store order items" ON public.order_items;
CREATE POLICY "Merchant can view own store order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_items.order_id
        AND s.owner_id = auth.uid()
    )
  );

-- Merchants can update order items from their own stores
DROP POLICY IF EXISTS "Merchant can update own store order items" ON public.order_items;
CREATE POLICY "Merchant can update own store order items"
  ON public.order_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_items.order_id
        AND s.owner_id = auth.uid()
    )
  );

-- Merchants can delete order items from their own stores
DROP POLICY IF EXISTS "Merchant can delete own store order items" ON public.order_items;
CREATE POLICY "Merchant can delete own store order items"
  ON public.order_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = order_items.order_id
        AND s.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. Order Creation RPC Function (Atomic Transaction)
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_order_atomic(jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_order_data jsonb,
  p_order_items_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_result jsonb;
BEGIN
  -- Extract order data
  v_order_id := (p_order_data->>'id')::uuid;
  v_order_number := p_order_data->>'order_number';
  
  -- Insert order
  INSERT INTO public.orders (
    id,
    store_id,
    order_number,
    status,
    currency,
    customer_name,
    customer_email,
    customer_phone,
    customer_whatsapp,
    company,
    country,
    state,
    city,
    address,
    notes,
    contact_preference,
    subtotal,
    customer_access_token,
    created_at,
    updated_at
  )
  SELECT
    v_order_id,
    (p_order_data->>'store_id')::uuid,
    v_order_number,
    p_order_data->>'status',
    p_order_data->>'currency',
    p_order_data->>'customer_name',
    p_order_data->>'customer_email',
    p_order_data->>'customer_phone',
    p_order_data->>'customer_whatsapp',
    p_order_data->>'company',
    p_order_data->>'country',
    p_order_data->>'state',
    p_order_data->>'city',
    p_order_data->>'address',
    p_order_data->>'notes',
    p_order_data->>'contact_preference',
    (p_order_data->>'subtotal')::numeric(12,2),
    p_order_data->>'customer_access_token',
    (p_order_data->>'created_at')::timestamptz,
    (p_order_data->>'updated_at')::timestamptz;
  
  -- Insert order items
  INSERT INTO public.order_items (
    id,
    order_id,
    product_id,
    variant_id,
    product_name_snapshot,
    sku_snapshot,
    variant_snapshot,
    quantity,
    unit_price_snapshot,
    line_total,
    created_at
  )
  SELECT
    (item->>'id')::uuid,
    v_order_id,
    (item->>'product_id')::uuid,
    (item->>'variant_id')::uuid,
    item->>'product_name_snapshot',
    item->>'sku_snapshot',
    item->'variant_snapshot',
    (item->>'quantity')::integer,
    (item->>'unit_price_snapshot')::numeric(12,2),
    (item->>'line_total')::numeric(12,2),
    (item->>'created_at')::timestamptz
  FROM jsonb_array_elements(p_order_items_data) AS item;
  
  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction rolls back automatically on error
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute on RPC to authenticated users (for server-side use)
GRANT EXECUTE ON FUNCTION public.create_order_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic TO anon;

-- ============================================================================
-- 6. Updated_at Trigger
-- ============================================================================

DROP FUNCTION IF EXISTS public.update_orders_updated_at();

CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_updated_at_trigger ON public.orders;

CREATE TRIGGER orders_updated_at_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_orders_updated_at();
