# Order System Design

**Phase 5: Order/Checkout 断链审计与数据模型设计**

**Date**: 2026-09-08  
**Status**: READ-ONLY DESIGN (No code changes, no database changes)

---

## Executive Summary

This document provides a comprehensive READ-ONLY analysis and design for the Omnilink Order/Checkout system. The current implementation has a **critical broken path**: `Storefront → Cart → Checkout → Order` where the `orders` and `order_items` tables do not exist in the remote database, and the system relies on a memory fallback.

**Key Finding**: The migration `20260819_000001_create_orders_and_order_items.sql` exists but has not been applied to the remote database. The current code in `app/actions/order.ts` implements a memory fallback when DB operations fail.

**Recommendation**: Apply the existing migration and remove the memory fallback to establish a persistent, secure order system.

---

## 1. Current Checkout Flow

### 1.1 UI Flow

```
Product Page
  ↓ (Add to Cart)
Cart (components/cart/CartPageView.tsx)
  ↓ (Proceed to Checkout)
Checkout (components/checkout/CheckoutPageView.tsx)
  ↓ (Submit Order Inquiry)
Order Confirmation (components/checkout/OrderConfirmationPageView.tsx)
```

### 1.2 Data Flow

```
CartContext (localStorage)
  ↓ CartItem[]: { productId, variantId, quantity, price, selectedOptions }
CheckoutPageView
  ↓ OrderSubmissionPayload: { storeSlug, customer, items }
submitOrderInquiryAction (app/actions/order.ts)
  ↓ Server Action
  ↓ Validates store existence
  ↓ Fetches server-authoritative product/variant prices
  ↓ Recalculates subtotal
  ↓ Attempts DB insert (orders + order_items)
  ↓ Falls back to memory if DB fails
  ↓ Returns OrderConfirmationDTO
OrderConfirmationPageView
  ↓ Displays order snapshot
```

### 1.3 Current Database Operations

**Attempted** (in `submitOrderInquiryAction`):
```typescript
await supabase.from('orders').insert({...})
await supabase.from('order_items').insert([...])
```

**Actual Result**: Tables do not exist in remote DB → fallback to memory Map.

---

## 2. Current Order Input

### 2.1 OrderSubmissionPayload (lib/storefront/types.ts)

```typescript
export interface OrderSubmissionPayload {
  storeSlug: string
  customer: OrderCustomerInfo
  items: OrderItemSubmission[]
}
```

### 2.2 OrderCustomerInfo

```typescript
export interface OrderCustomerInfo {
  name: string              // REQUIRED
  email: string             // REQUIRED
  phone?: string
  whatsapp?: string
  company?: string
  country?: string
  state?: string
  city?: string
  address?: string
  notes?: string
  contactPreference?: 'email' | 'whatsapp' | 'phone'
}
```

**Status**: All fields exist in current UI and are submitted.

### 2.3 OrderItemSubmission

```typescript
export interface OrderItemSubmission {
  productId: string
  variantId?: string | null
  quantity: number
  selectedOptions?: Record<string, string>
}
```

**Status**: All fields exist. Note: **NO price submitted** from client (correct security design).

### 2.4 What's Missing

**None** - the current input structure is complete for MVP inquiry-based checkout.

**What's NOT included (by design, not missing)**:
- Shipping cost (calculated post-inquiry by merchant)
- Tax (calculated post-inquiry by merchant)
- Discount (not implemented)
- Payment method (inquiry-based, no online payment)

---

## 3. Current Pricing Model

### 3.1 Price Sources

| Source | Location | Type | Trust Level |
|--------|----------|------|-------------|
| Product base price | `products.price` | numeric | Server-authoritative |
| Variant price | `product_variants.price` | numeric | Server-authoritative |
| Cart price | `CartItem.price` | numeric | Client-side display only |
| Demo products | `DEMO_PRODUCTS` constant | Hardcoded | Demo-only |

### 3.2 Current Price Calculation (app/actions/order.ts)

```typescript
// Server-side recalculation (TRUST BOUNDARY)
for (const item of items) {
  // 1. Fetch product price from DB
  const foundDbProd = dbProducts.find((p) => p.id === item.productId)
  
  // 2. Check variant price override
  if (item.variantId) {
    const foundVariant = dbVariants.find((v) => v.id === item.variantId)
    if (foundVariant?.price !== null) {
      unitPrice = Number(foundVariant.price)
    }
  }
  
  // 3. Calculate line total
  const itemTotal = unitPrice * qty
  calculatedSubtotal += itemTotal
}
```

**Status**: **CORRECT** - Server re-fetches and recalculates all prices, ignoring any client-submitted prices.

### 3.3 Price Trust Boundary

**Current Implementation**: ✅ **SECURE**

- Client submits: `{ productId, variantId, quantity }`
- Server: Fetches fresh prices from DB, recalculates subtotal
- Client cannot influence order total

**No Changes Needed** - the current price trust boundary is already correct.

---

## 4. Minimal Order Data Model

### 4.1 Existing Migration (20260819_000001_create_orders_and_order_items.sql)

The migration already defines the minimal order model:

```sql
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number text NOT NULL,
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
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'inquiry_pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 4.2 Field Analysis

| Field | Required? | Source | Notes |
|-------|-----------|--------|-------|
| id | Yes | System | UUID primary key |
| store_id | Yes | Server (from storeSlug) | Foreign key to stores |
| order_number | Yes | Server-generated | Human-readable reference |
| customer_name | Yes | Customer input | |
| customer_email | Yes | Customer input | |
| customer_phone | No | Customer input | |
| customer_whatsapp | No | Customer input | |
| company | No | Customer input | |
| country | No | Customer input | |
| state | No | Customer input | |
| city | No | Customer input | |
| address | No | Customer input | |
| notes | No | Customer input | |
| contact_preference | No | Customer input | Default: 'email' |
| currency | Yes | Store currency | From stores.currency |
| subtotal | Yes | Server-calculated | Sum of line items |
| status | Yes | System | Default: 'inquiry_pending' |
| created_at | Yes | System | Timestamp |
| updated_at | Yes | System | Timestamp |

### 4.3 Missing Fields (Not Needed for MVP)

**NOT included** (intentionally minimal):
- `shipping_amount` - Calculated post-inquiry
- `tax_amount` - Calculated post-inquiry
- `discount_amount` - No discount system
- `total_amount` - Subtotal is sufficient for inquiry
- `payment_status` - No online payment
- `payment_method` - Inquiry-based
- `customer_id` - No customer accounts (anonymous checkout)
- `billing_address` - Same as shipping for MVP

**Conclusion**: The existing migration defines the **minimal viable order model** for Omnilink's inquiry-based checkout. No changes needed.

---

## 5. Minimal Order Item Data Model

### 5.1 Existing Migration

```sql
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name_snapshot text NOT NULL,
  sku_snapshot text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_snapshot numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  selected_options jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

### 5.2 Field Analysis

| Field | Required? | Source | Purpose |
|-------|-----------|--------|---------|
| id | Yes | System | UUID primary key |
| order_id | Yes | System | Foreign key to orders |
| product_id | No | Client | Reference to product (SET NULL on delete) |
| variant_id | No | Client | Reference to variant (SET NULL on delete) |
| product_name_snapshot | Yes | Server | **PRICE SNAPSHOT** - preserves product name at order time |
| sku_snapshot | No | Server | **PRICE SNAPSHOT** - preserves SKU at order time |
| quantity | Yes | Client | Order quantity |
| unit_price_snapshot | Yes | Server | **PRICE SNAPSHOT** - preserves price at order time |
| currency | Yes | Server | Currency at order time |
| selected_options | No | Client | Variant options (e.g., color, size) |
| created_at | Yes | System | Timestamp |

### 5.3 Critical Design: Why Snapshots?

**Question**: Why can't order items just reference `product_id` and read current prices?

**Answer**: **Price and product information must be snapshotted at order time.**

**Reasons**:
1. **Price changes**: If a product price changes after order creation, the order total must not change.
2. **Product deletion**: If a product is deleted, the order must still show what was ordered.
3. **Product name changes**: If a product is renamed, the order must show the name at order time.
4. **Audit trail**: Orders are legal/financial records that must reflect the state at transaction time.
5. **Variant changes**: If variant options change, the order must show the exact options selected.

**Current Implementation**: ✅ **CORRECT**

The existing migration includes all necessary snapshots:
- `product_name_snapshot` - Product name at order time
- `sku_snapshot` - SKU at order time
- `unit_price_snapshot` - Price at order time

**Conclusion**: The existing migration correctly implements order item snapshots. No changes needed.

---

## 6. Order Ownership Model

### 6.1 Current Ownership Chain

```
stores.owner_id = auth.uid()
  ↓
orders.store_id = stores.id
  ↓
order_items.order_id = orders.id
```

### 6.2 Merchant Access

**Current RLS (from migration)**:
```sql
CREATE POLICY "Store owners can manage their orders"
  ON orders FOR ALL
  USING (
    store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()
    )
  );
```

**Status**: ✅ **CORRECT** - Merchants can only access orders from their own store.

### 6.3 Customer Access

**Current RLS (from migration)**:
```sql
CREATE POLICY "Public can view own order"
  ON orders FOR SELECT
  USING (true);
```

**Status**: ❌ **INSECURE** - This allows ANYONE to view ANY order by guessing the `order_id`.

### 6.4 Anonymous Checkout

**Current Implementation**:
- No customer accounts
- No authentication required for checkout
- Order created with customer email/name only
- Customer receives order confirmation page with `orderId`

**Problem**: Without authentication, how does a customer prove they own an order?

**Current RLS Flaw**:
```sql
USING (true)  -- Allows anyone to read any order
```

This means:
- Customer A can view Customer B's order by guessing the `orderId`
- No security boundary between customers

### 6.5 Recommended Ownership Model

**Option 1: Email-based access (Recommended for MVP)**

Add a field to orders:
```sql
ALTER TABLE orders ADD COLUMN customer_access_token text;
```

- Generate a random token when order is created
- Include token in order confirmation URL: `/order-confirmation/{orderId}?token={token}`
- RLS policy: `USING (customer_access_token = current_setting('request.jwt.claims', true)::json->>'order_token')`

**Option 2: Order number + email verification**

- Require customer to enter order number + email to view order
- Server validates email matches order.customer_email
- More friction, but no token needed

**Option 3: Customer accounts (Future)**

- Require customer to create account before checkout
- Link orders to customer_id
- RLS: `USING (customer_id = auth.uid())`

**Recommendation**: **Option 1 (Email-based access token)** for MVP.
- Minimal friction
- Secure
- Fits current anonymous checkout model

---

## 7. Anonymous Checkout Model

### 7.1 Current Anonymous Flow

```
Anonymous Customer
  ↓ Fills checkout form (name, email, address)
  ↓ Submits order
  ↓ Receives order confirmation page
  ↓ Can view order via URL (INSECURE - anyone can view)
```

### 7.2 Security Issues

1. **Order enumeration**: Anyone can guess `orderId` and view other customers' orders
2. **No customer authentication**: No way to prove order ownership
3. **RLS too permissive**: `USING (true)` allows public read of all orders

### 7.3 Recommended Anonymous Checkout Model

**Flow**:
```
Anonymous Customer
  ↓ Fills checkout form (name, email, address)
  ↓ Submits order
  ↓ Server generates access_token
  ↓ Server returns order confirmation URL with token
  ↓ Customer receives URL (e.g., /order-confirmation/{orderId}?token=abc123)
  ↓ Customer can only view order with correct token
  ↓ Token expires after 7 days (optional)
```

**Implementation**:
```sql
ALTER TABLE orders ADD COLUMN customer_access_token text;
CREATE INDEX idx_orders_customer_access_token ON orders(customer_access_token);

-- RLS Policy
CREATE POLICY "Customers can view own order with token"
  ON orders FOR SELECT
  USING (
    customer_access_token = current_setting('request.order_token', true)
  );
```

**Server Action**:
```typescript
const accessToken = crypto.randomBytes(32).toString('hex')
await supabase.from('orders').insert({
  ...orderData,
  customer_access_token: accessToken
})
return { orderId, accessToken }
```

**Confirmation Page**:
```typescript
// Validate token before showing order
const token = searchParams.get('token')
if (!token) return 404

const order = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)
  .eq('customer_access_token', token)
  .single()
```

---

## 8. Price Trust Boundary

### 8.1 Current Implementation

**Status**: ✅ **ALREADY SECURE**

The current `submitOrderInquiryAction` correctly implements server-side price recalculation:

```typescript
// Client submits ONLY identifiers
const payloadItems = items.map((it) => ({
  productId: it.productId,
  variantId: it.variantId || null,
  quantity: it.quantity,
  selectedOptions: it.selectedOptions,
}))

// Server re-fetches prices from DB
const { data: dbProducts } = await supabase
  .from('products')
  .select('id, name, price, currency')
  .eq('store_id', store.id)
  .in('id', productIds)

// Server recalculates subtotal
for (const item of items) {
  const foundDbProd = dbProducts.find((p) => p.id === item.productId)
  unitPrice = Number(foundDbProd.price) || 0
  calculatedSubtotal += unitPrice * qty
}
```

### 8.2 Trust Boundary Analysis

| Component | Trust Level | Reason |
|-----------|-------------|--------|
| Client price display | ❌ Untrusted | For UI only, not submitted |
| Client quantity | ⚠️ Semi-trusted | Validated server-side (min 1) |
| Server product price | ✅ Trusted | Source of truth |
| Server variant price | ✅ Trusted | Overrides product price if present |
| Calculated subtotal | ✅ Trusted | Server-calculated from trusted prices |

### 8.3 No Changes Needed

The current price trust boundary is **already correct**. The server:
1. Ignores any client-submitted prices
2. Re-fetches fresh prices from the database
3. Recalculates the subtotal server-side
4. Snapshots the final prices in order_items

**Recommendation**: Keep the current implementation unchanged.

---

## 9. Order State Machine

### 9.1 Current Status Field

```sql
status text NOT NULL DEFAULT 'inquiry_pending'
```

### 9.2 Current States

From code analysis, only one state is currently used:
- `inquiry_pending` - Default state for new orders

### 9.3 Minimal State Machine for MVP

**Recommended states**:
```typescript
type OrderStatus = 
  | 'inquiry_pending'    // Order submitted, awaiting merchant review
  | 'confirmed'         // Merchant confirmed availability
  | 'processing'         // Order being prepared/shipped
  | 'completed'          // Order delivered/closed
  | 'cancelled'          // Order cancelled by merchant or customer
```

### 9.4 State Transitions

```
inquiry_pending
  ↓ (merchant confirms)
confirmed
  ↓ (merchant starts processing)
processing
  ↓ (order delivered)
completed

inquiry_pending → cancelled (merchant rejects)
confirmed → cancelled (customer cancels)
processing → cancelled (merchant cancels)
```

### 9.5 Implementation

**Database constraint** (recommended):
```sql
ALTER TABLE orders 
  ADD CONSTRAINT check_valid_status 
  CHECK (status IN ('inquiry_pending', 'confirmed', 'processing', 'completed', 'cancelled'));
```

**Current Status**: The migration uses a free-form text field. Adding a CHECK constraint is recommended but not critical for MVP.

**Recommendation**: Add CHECK constraint for state validation before implementing merchant order management UI.

---

## 10. RLS / Authorization Model

### 10.1 Current RLS Policies (from migration)

#### Orders Table

```sql
-- Policy 1: Public can create orders
CREATE POLICY "Public can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Policy 2: Public can view own order
CREATE POLICY "Public can view own order"
  ON orders FOR SELECT
  USING (true);

-- Policy 3: Store owners can manage their orders
CREATE POLICY "Store owners can manage their orders"
  ON orders FOR ALL
  USING (
    store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()
    )
  );
```

#### Order Items Table

```sql
-- Policy 1: Public can insert order items
CREATE POLICY "Public can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- Policy 2: Public can view order items
CREATE POLICY "Public can view order items"
  ON order_items FOR SELECT
  USING (true);

-- Policy 3: Store owners can manage their order items
CREATE POLICY "Store owners can manage their order items"
  ON order_items FOR ALL
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN stores s ON o.store_id = s.id
      WHERE s.owner_id = auth.uid()
    )
  );
```

### 10.2 Security Analysis

| Policy | Status | Issue |
|--------|--------|-------|
| Public can create orders | ✅ OK | Allows anonymous checkout (intended) |
| Public can view own order | ❌ CRITICAL | `USING (true)` allows anyone to view any order |
| Store owners can manage their orders | ✅ OK | Correctly scoped to store ownership |
| Public can insert order items | ✅ OK | Required for order creation |
| Store owners can manage their order items | ✅ OK | Correctly scoped via order ownership |

### 10.3 Critical Security Flaw

**Policy 2: "Public can view own order"**

```sql
USING (true)  -- ❌ INSECURE
```

**Impact**: 
- Any anonymous user can query `SELECT * FROM orders` and see ALL orders
- Order enumeration attack: guess UUIDs to view other customers' orders
- Customer data leak: names, emails, addresses exposed

**Fix Required**:

**Option A: Access token (Recommended)**
```sql
ALTER TABLE orders ADD COLUMN customer_access_token text;

CREATE POLICY "Customers can view own order with token"
  ON orders FOR SELECT
  USING (
    customer_access_token = current_setting('request.order_token', true)
  );
```

**Option B: Order number + email (Alternative)**
```sql
CREATE POLICY "Customers can view own order by email"
  ON orders FOR SELECT
  USING (
    customer_email = current_setting('request.customer_email', true)
    AND order_number = current_setting('request.order_number', true)
  );
```

**Option C: Remove public read entirely (Most secure)**
```sql
DROP POLICY "Public can view own order";

-- Customers can only view order confirmation immediately after creation
-- via server action that checks ownership
```

**Recommendation**: **Option A (Access token)** for MVP balance of security and UX.

### 10.4 Recommended RLS Model

```sql
-- Orders Table

-- 1. Public can create orders (anonymous checkout)
CREATE POLICY "Public can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- 2. Customers can view own order with access token
CREATE POLICY "Customers can view own order with token"
  ON orders FOR SELECT
  USING (
    customer_access_token = current_setting('request.order_token', true)
  );

-- 3. Store owners can manage their orders
CREATE POLICY "Store owners can manage their orders"
  ON orders FOR ALL
  USING (
    store_id IN (
      SELECT s.id FROM stores s WHERE s.owner_id = auth.uid()
    )
  );

-- Order Items Table

-- 1. Public can insert order items (required for order creation)
CREATE POLICY "Public can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- 2. Customers can view order items via order access token
CREATE POLICY "Customers can view order items with token"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
      AND o.customer_access_token = current_setting('request.order_token', true)
    )
  );

-- 3. Store owners can manage their order items
CREATE POLICY "Store owners can manage their order items"
  ON order_items FOR ALL
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN stores s ON o.store_id = s.id
      WHERE s.owner_id = auth.uid()
    )
  );
```

---

## 11. Supabase Client / Auth Model

### 11.1 Current Client Usage

**Server Client** (`lib/supabase/server.ts`):
```typescript
export async function createClientServer() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll, setAll }
  })
}
```

**Usage Pattern**:
- All server actions use `createClientServer()`
- Reads auth session from cookies
- Uses anon key (not service role)
- RLS provides authorization

### 11.2 Auth Patterns in Codebase

**Merchant Routes** (from `lib/api/auth.ts`):
```typescript
export async function requireUser(): Promise<AuthResult> {
  const supabase = await createClientServer()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user) return { ok: false, response: 401 }
  return { ok: true, supabase, user }
}

export async function ownsStore(supabase, user, storeId): Promise<boolean> {
  const { data } = await supabase
    .from('stores')
    .select('id')
    .eq('id', storeId)
    .eq('owner_id', user.id)
    .maybeSingle()
  return !error && !!data
}
```

**Pattern**: Auth check → Ownership check → Resource access

### 11.3 Order/Checkout Auth Model

**Current Implementation**:
```typescript
// submitOrderInquiryAction - NO auth required (anonymous checkout)
const supabase = await createClientServer()
// No getUser() call
// Direct insert to orders table
```

**Status**: ✅ **CORRECT** for anonymous checkout model.

### 11.4 Recommended Auth Model for Orders

**Anonymous Order Creation** (Current - Keep):
```typescript
// No auth required
const supabase = await createClientServer()
await supabase.from('orders').insert({...})
```

**Merchant Order Access** (Current - Keep):
```typescript
const auth = await requireUser()
const { supabase, user } = auth
const store = await getOwnedStore(supabase, user)
const orders = await supabase
  .from('orders')
  .select('*')
  .eq('store_id', store.id)
```

**Customer Order Access** (New - Add token validation):
```typescript
// Option 1: Token-based (recommended)
const token = searchParams.get('token')
const order = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)
  .eq('customer_access_token', token)
  .single()

// Option 2: Server action with ownership check
export async function getOrderForCustomer(orderId: string, email: string) {
  const supabase = await createClientServer()
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('customer_email', email)
    .single()
  return data
}
```

### 11.5 Service Role Client

**Current Usage**: None in order context.

**Should it be used?**: **NO**

**Reason**:
- Service role bypasses RLS
- Creates security risk if misused
- Current anon key + RLS is sufficient
- Only use service role for admin operations that explicitly bypass RLS

**Recommendation**: Continue using anon key with RLS for all order operations.

---

## 12. Current Memory Fallback

### 12.1 Current Implementation (app/actions/order.ts)

```typescript
// Fallback in-memory storage for demo sessions or before DB migration sync
const memoryOrders = new Map<string, OrderConfirmationDTO>()

// Demo products price lookup for omnilink-flagship
const DEMO_PRODUCTS: Record<string, {...}> = {...}

export async function submitOrderInquiryAction(...) {
  // ... server-side price calculation ...
  
  // 4. Try Persisting to DB
  let persistedToDb = false
  if (store.id !== 'demo-store') {
    try {
      const { error: orderError } = await supabase.from('orders').insert({...})
      if (!orderError) {
        const { error: itemsError } = await supabase.from('order_items').insert([...])
        if (!itemsError) {
          persistedToDb = true
        }
      }
    } catch (dbErr) {
      console.warn('Orders DB insert fallback to memory:', dbErr)
    }
  }
  
  // Always store snapshot in memory registry to guarantee immediate confirmation view
  memoryOrders.set(orderId, confirmationDto)
  
  return { success: true, orderId, orderNumber }
}

export async function getOrderConfirmationAction(storeSlug, orderId) {
  // Check memory first
  if (memoryOrders.has(orderId)) {
    return memoryOrders.get(orderId)!
  }
  
  // Fallback to service layer
  const { getOrderById } = await import('@/lib/storefront/service')
  return await getOrderById(storeSlug, orderId)
}
```

### 12.2 Why Memory Fallback Exists

**Analysis**:

1. **Demo store support*: Hardcoded `DEMO_PRODUCTS` for `omnilink-flagship` demo store
2. **DB migration not applied**: Tables don't exist in remote DB
3. **Immediate confirmation view**: Guarantees confirmation page works even if DB fails
4. **Development convenience**: Allows testing without DB setup

### 12.3 Is it Demo or Business Critical?

**Answer**: **Demo/Development artifact, not business-critical**

**Evidence**:
- Only used for `demo-store` (hardcoded)
- Comment says "demo sessions or before DB migration sync"
- Real stores should persist to DB
- Memory is lost on server restart

### 12.4 Should It Be Removed?

**Answer**: **YES - Must be removed after DB migration is applied**

**Reasons**:
1. **Data loss**: Orders lost on server restart
2. **No audit trail**: Memory orders not queryable
3. **No merchant access**: Merchants cannot see memory orders
4. **Security bypass**: No RLS on memory Map
5. **Scalability**: Memory not scalable across multiple instances

### 12.5 Are There Other Dependencies?

**Analysis**: Only `getOrderConfirmationAction` depends on memory fallback.

**Impact**: Low - single function can be updated to query DB directly.

### 12.6 Recommendation

**Phase 1 (Immediate)**:
- Apply migration `20260819_000001_create_orders_and_order_items.sql` to remote DB
- Test DB insert works
- Keep memory fallback as safety net during transition

**Phase 2 (After verification)**:
- Remove `memoryOrders` Map
- Remove `DEMO_PRODUCTS` constant
- Update `getOrderConfirmationAction` to query DB only
- Remove demo-store special case

**Final Principle**: 
> **正式 Order persistence 建立后，不允许 memory fallback 继续作为生产路径。**

---

## 13. Required Database Changes

### 13.1 Critical Changes (Required for MVP)

#### 13.1.1 Apply Existing Migration

**Status**: Migration exists but not applied to remote DB.

**Action**:
```bash
supabase db push
```

**Migration**: `20260819_000001_create_orders_and_order_items.sql`

**Impact**: Creates `orders` and `order_items` tables with RLS.

#### 13.1.2 Add Customer Access Token

**Status**: New field needed for secure customer access.

**Migration**:
```sql
-- Add customer access token field
ALTER TABLE orders ADD COLUMN customer_access_token text;

-- Add index for token lookups
CREATE INDEX idx_orders_customer_access_token ON orders(customer_access_token);

-- Update RLS policies (see Section 10.4)
```

**Impact**: Enables secure anonymous order access.

#### 13.1.3 Fix RLS Security Flaw

**Status**: Current RLS allows public read of all orders.

**Action**: Replace `USING (true)` with token-based policy (see Section 10.4).

**Impact**: Prevents order enumeration attacks.

### 13.2 Optional Changes (Nice to Have)

#### 13.2.1 Add Status CHECK Constraint

**Migration**:
```sql
ALTER TABLE orders 
  ADD CONSTRAINT check_valid_status 
  CHECK (status IN ('inquiry_pending', 'confirmed', 'processing', 'completed', 'cancelled'));
```

**Impact**: Enforces valid status values.

#### 13.2.2 Add Updated_at Trigger

**Migration**:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**Impact**: Auto-updates `updated_at` on row changes.

### 13.3 No Changes Needed

The following are already correctly designed:
- Order table schema (minimal and complete)
- Order item schema (includes snapshots)
- Foreign key relationships
- Indexes for performance
- Merchant RLS policies

---

## 14. Required Code Changes

### 14.1 Critical Changes (Required for MVP)

#### 14.1.1 Remove Memory Fallback

**File**: `app/actions/order.ts`

**Changes**:
1. Remove `memoryOrders` Map
2. Remove `DEMO_PRODUCTS` constant
3. Remove demo-store special case
4. Remove memory fallback logic
5. Update `getOrderConfirmationAction` to query DB only

**Before**:
```typescript
const memoryOrders = new Map<string, OrderConfirmationDTO>()
const DEMO_PRODUCTS: Record<string, {...}> = {...}

export async function submitOrderInquiryAction(...) {
  // ... DB insert ...
  if (!persistedToDb) {
    memoryOrders.set(orderId, confirmationDto)
  }
}

export async function getOrderConfirmationAction(...) {
  if (memoryOrders.has(orderId)) {
    return memoryOrders.get(orderId)!
  }
  return await getOrderById(storeSlug, orderId)
}
```

**After**:
```typescript
export async function submitOrderInquiryAction(...) {
  // ... DB insert ...
  if (orderError || itemsError) {
    return { success: false, error: 'Failed to create order' }
  }
  return { success: true, orderId, orderNumber }
}

export async function getOrderConfirmationAction(storeSlug, orderId) {
  return await getOrderById(storeSlug, orderId)
}
```

#### 14.1.2 Generate Access Token

**File**: `app/actions/order.ts`

**Changes**:
1. Generate random access token when creating order
2. Include token in order insert
3. Return token to client

**Code**:
```typescript
const accessToken = crypto.randomBytes(32).toString('hex')

const { error: orderError } = await supabase.from('orders').insert({
  ...orderData,
  customer_access_token: accessToken
})

return { 
  success: true, 
  orderId, 
  orderNumber,
  accessToken  // New
}
```

#### 14.1.3 Update Confirmation Page URL

**File**: `components/checkout/CheckoutPageView.tsx`

**Changes**:
1. Include access token in redirect URL
2. Pass token to confirmation page

**Code**:
```typescript
if (result.success && result.orderId && result.accessToken) {
  clearCart()
  router.push(
    `/store/${store.slug}/order-confirmation/${result.orderId}?token=${result.accessToken}`
  )
}
```

#### 14.1.4 Validate Token on Confirmation Page

**File**: `app/[storeSlug]/order-confirmation/[orderId]/page.tsx` (or similar)

**Changes**:
1. Extract token from URL
2. Validate token before fetching order
3. Return 404 if token invalid

**Code**:
```typescript
export default async function OrderConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{ storeSlug: string; orderId: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { storeSlug, orderId } = await params
  const { token } = await searchParams
  
  if (!token) {
    notFound()
  }
  
  const order = await getOrderById(storeSlug, orderId, token)
  if (!order) {
    notFound()
  }
  
  return <OrderConfirmationPageView order={order} store={store} />
}
```

#### 14.1.5 Update getOrderById to Validate Token

**File**: `lib/storefront/service.ts`

**Changes**:
1. Add token parameter
2. Include token in WHERE clause
3. Use `current_setting` for RLS

**Code**:
```typescript
export async function getOrderById(
  storeSlug: string,
  orderId: string,
  accessToken?: string
): Promise<OrderConfirmationDTO | null> {
  const supabase = await createClientServer()
  
  // Set token for RLS
  if (accessToken) {
    await supabase.rpc('set_config', { key: 'request.order_token', value: accessToken })
  }
  
  const { data: order, error } = await supabase
    .from('orders')
    .select(...)
    .eq('id', orderId)
    .maybeSingle()
  
  // ... rest of function
}
```

### 14.2 Optional Changes (Nice to Have)

#### 14.2.1 Add Order Status Management

**New File**: `app/actions/order-management.ts`

**Purpose**: Allow merchants to update order status.

**Code**:
```typescript
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const auth = await requireUser()
  const { supabase, user } = auth
  
  const { owned } = await ownsOrder(supabase, user, orderId)
  if (!owned) {
    return { success: false, error: 'Order not found' }
  }
  
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
  
  return { success: !error }
}
```

#### 14.2.2 Add Merchant Order List Page

**New File**: `app/dashboard/orders/page.tsx`

**Purpose**: Merchant dashboard to view and manage orders.

**Features**:
- List all orders for merchant's store
- Filter by status
- Update order status
- View order details

### 14.3 No Changes Needed

The following are already correctly implemented:
- Server-side price recalculation
- Order data structure
- Order item snapshots
- Merchant auth pattern
- Store ownership checks

---

## 15. Risks

### 15.1 Critical Risks (Must Address)

#### 15.1.1 RLS Security Flaw

**Risk**: Public can read all orders via `USING (true)` policy.

**Impact**: Customer data leak, privacy violation, compliance issue.

**Mitigation**: Implement token-based access control (Section 10.4).

**Priority**: **CRITICAL** - Must fix before production.

#### 15.1.2 Memory Fallback Data Loss

**Risk**: Orders stored in memory lost on server restart.

**Impact**: Lost orders, customer dissatisfaction, business loss.

**Mitigation**: Apply DB migration, remove memory fallback (Section 12).

**Priority**: **CRITICAL** - Must fix before production.

#### 15.1.3 Order Enumeration Attack

**Risk**: Customers can guess order IDs and view other customers' orders.

**Impact**: Privacy violation, data leak.

**Mitigation**: Implement access token validation (Section 7).

**Priority**: **CRITICAL** - Must fix before production.

### 15.2 Medium Risks (Should Address)

#### 15.2.1 No Order Status Validation

**Risk**: Free-form text field allows invalid status values.

**Impact**: Data inconsistency, UI errors.

**Mitigation**: Add CHECK constraint (Section 13.2.1).

**Priority**: **MEDIUM** - Should fix before merchant order management.

#### 15.2.2 No Customer Account Linking

**Risk**: No way for customers to view past orders without access token.

**Impact**: Poor UX, customer frustration.

**Mitigation**: Implement customer accounts or email-based order lookup (future).

**Priority**: **MEDIUM** - Acceptable for MVP, improve in future.

#### 15.2.3 Database Typing Missing

**Risk**: `lib/database.types.ts` does not include `orders` and `order_items` tables.

**Impact**: TypeScript cannot catch type errors in order queries.

**Mitigation**: Regenerate types after migration (Section 16).

**Priority**: **MEDIUM** - Should fix for type safety.

### 15.3 Low Risks (Can Defer)

#### 15.3.1 No Updated_at Trigger

**Risk**: `updated_at` field not auto-updated.

**Impact**: Manual updates required, potential inconsistency.

**Mitigation**: Add trigger (Section 13.2.2).

**Priority**: **LOW** - Nice to have, not critical.

#### 15.3.2 No Order Number Uniqueness Constraint

**Risk**: Potential duplicate order numbers (unlikely with current generation).

**Impact**: Confusion in order references.

**Mitigation**: Add UNIQUE constraint on `order_number`.

**Priority**: **LOW** - Current generation makes collisions extremely unlikely.

---

## 16. Recommended Implementation Order

### Phase 1: Database Foundation (Day 1)

**Goal**: Establish persistent order storage.

**Steps**:
1. Apply migration `20260819_000001_create_orders_and_order_items.sql`
   ```bash
   supabase db push
   ```

2. Verify tables created in remote DB
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_name IN ('orders', 'order_items');
   ```

3. Test order creation with existing code
   - Submit test order via checkout
   - Verify order appears in DB
   - Verify memory fallback not triggered

4. Regenerate TypeScript types
   ```bash
   supabase gen types typescript --local > lib/database.types.ts
   ```

**Success Criteria**:
- Orders persist to DB
- No memory fallback triggered
- TypeScript types include orders/order_items

---

### Phase 2: Security Fix (Day 1)

**Goal**: Fix RLS security flaw.

**Steps**:
1. Create migration to add access token field
   ```sql
   -- supabase/migrations/20260908_000001_add_order_access_token.sql
   ALTER TABLE orders ADD COLUMN customer_access_token text;
   CREATE INDEX idx_orders_customer_access_token ON orders(customer_access_token);
   ```

2. Create migration to fix RLS policies
   ```sql
   -- supabase/migrations/20260908_000002_fix_order_rls.sql
   DROP POLICY IF EXISTS "Public can view own order" ON orders;
   CREATE POLICY "Customers can view own order with token"
     ON orders FOR SELECT
     USING (
       customer_access_token = current_setting('request.order_token', true)
     );
   ```

3. Apply migrations
   ```bash
   supabase db push
   ```

**Success Criteria**:
- Access token field exists
- Old `USING (true)` policy removed
- New token-based policy in place

---

### Phase 3: Code Updates (Day 2)

**Goal**: Update code to use access tokens and remove memory fallback.

**Steps**:
1. Update `app/actions/order.ts`
   - Generate access token on order creation
   - Return access token in response
   - Remove memory fallback
   - Remove `DEMO_PRODUCTS`

2. Update `components/checkout/CheckoutPageView.tsx`
   - Include access token in redirect URL

3. Update `lib/storefront/service.ts`
   - Add token parameter to `getOrderById`
   - Set token for RLS

4. Update order confirmation page
   - Validate token before showing order
   - Return 404 if token invalid

5. Test end-to-end flow
   - Submit order
   - Verify access token in URL
   - Verify confirmation page loads
   - Verify invalid token returns 404
   - Verify order persists in DB

**Success Criteria**:
- Orders created with access token
- Confirmation page validates token
- Invalid tokens rejected
- No memory fallback used

---

### Phase 4: Merchant Order Management (Day 3-4)

**Goal**: Enable merchants to view and manage orders.

**Steps**:
1. Create `app/actions/order-management.ts`
   - `updateOrderStatus` action
   - `getMerchantOrders` action

2. Create `app/dashboard/orders/page.tsx`
   - List orders for merchant's store
   - Filter by status
   - Update order status UI

3. Create `app/dashboard/orders/[orderId]/page.tsx`
   - Order detail view
   - Order items list
   - Customer information

4. Test merchant order management
   - Login as merchant
   - View order list
   - Update order status
   - Verify status changes

**Success Criteria**:
- Merchants can view their orders
- Merchants can update order status
- Status changes persist to DB
- Merchants cannot see other stores' orders

---

### Phase 5: Validation & Testing (Day 5)

**Goal**: Validate entire order system.

**Steps**:
1. Security testing
   - Test order enumeration attack (should fail)
   - Test cross-store order access (should fail)
   - Test token validation (should work)

2. Functional testing
   - Test anonymous checkout
   - Test order confirmation
   - Test merchant order management
   - Test order status transitions

3. Edge case testing
   - Test with deleted products (should show snapshot)
   - Test with deleted variants (should show snapshot)
   - Test with price changes (should show snapshot)

4. Performance testing
   - Test order creation performance
   - Test order list performance
   - Test order detail performance

**Success Criteria**:
- All security tests pass
- All functional tests pass
- All edge cases handled correctly
- Performance acceptable

---

### Phase 6: Cleanup (Day 5)

**Goal**: Remove demo artifacts and clean up code.

**Steps**:
1. Remove `memoryOrders` Map from `app/actions/order.ts`
2. Remove `DEMO_PRODUCTS` constant from `app/actions/order.ts`
3. Remove demo-store special case from `app/actions/order.ts`
4. Remove demo-store special case from `lib/storefront/service.ts`
5. Update `getOrderConfirmationAction` to query DB only

**Success Criteria**:
- No memory fallback code remains
- No demo products code remains
- All order operations use DB

---

## 17. Final Answers

### 1. 当前 Checkout 到底缺什么？

**答案**: 缺少 **数据库持久化** 和 **安全访问控制**。

**具体缺失**:
1. `orders` 和 `order_items` 表在远端数据库不存在（migration 未应用）
2. RLS 策略存在安全漏洞（`USING (true)` 允许任何人读取所有订单）
3. 缺少客户访问令牌（无法安全地让匿名客户查看自己的订单）
4. 依赖内存 fallback（服务器重启会丢失订单）

**不缺失**:
- ✅ UI 完整（购物车、结账、确认页面）
- ✅ 数据结构完整（客户信息、商品信息、选项）
- ✅ 价格信任边界正确（服务端重新计算价格）
- ✅ 订单快照设计正确（保存下单时的商品信息）

---

### 2. 最小需要哪些数据库表？

**答案**: **orders** 和 **order_items** 两个表已经足够。

**现有 migration 已经定义了最小可行模型**:

- **orders 表**: 存储订单头信息（客户、商店、金额、状态）
- **order_items 表**: 存储订单行项目（商品快照、价格快照、数量）

**额外需要的字段**:
- `orders.customer_access_token` - 用于安全的匿名客户访问

**不需要的表**:
- ❌ customers 表 - MVP 不需要客户账户
- ❌ payments 表 - MVP 不需要在线支付
- ❌ shipping 表 - 运费由商家线下计算
- ❌ discounts 表 - MVP 不需要折扣系统

---

### 3. Order 应该由谁创建？

**答案**: **服务端 Server Action** (`submitOrderInquiryAction`) 创建订单。

**创建流程**:
```
匿名客户
  ↓ 提交 { storeSlug, customer, items }
服务端 Server Action
  ↓ 验证 store 存在
  ↓ 重新从 DB 读取商品价格（信任边界）
  ↓ 重新计算 subtotal
  ↓ 生成 access_token
  ↓ 插入 orders 表
  ↓ 插入 order_items 表
  ↓ 返回 { orderId, orderNumber, accessToken }
```

**关键原则**:
- ❌ 客户端不能直接插入订单（绕过价格验证）
- ❌ 客户端不能提交 total（服务端重新计算）
- ✅ 服务端验证所有数据
- ✅ 服务端重新计算价格
- ✅ 服务端生成订单号和访问令牌

---

### 4. 价格到底由谁决定？

**答案**: **服务端从数据库读取的当前商品价格**。

**价格决策链**:
```
商品价格来源（按优先级）:
1. product_variants.price (如果有 variant)
2. products.price (base price)
3. DEMO_PRODUCTS (仅 demo-store)
```

**信任边界**:
```
客户端提交: { productId, variantId, quantity }
  ↓ (忽略客户端价格)
服务端: 从 DB 读取当前价格
  ↓ (重新计算)
服务端: 计算 subtotal = sum(unit_price * quantity)
  ↓ (快照)
服务端: 保存 unit_price_snapshot 到 order_items
```

**为什么不能信任客户端价格**:
- 客户可能篡改价格（0.01 元购买 1000 元商品）
- 商品价格可能在客户加购后发生变化
- 必须保存下单时的价格快照（用于审计和法律合规）

**当前实现**: ✅ **已经正确** - 服务端重新计算价格，忽略客户端提交的价格。

---

### 5. 下一步实际实施顺序是什么？

**答案**: 按以下顺序实施（预计 5 天）:

**Day 1: 数据库基础**
1. 应用 migration `20260819_000001_create_orders_and_order_items.sql`
2. 验证表在远端 DB 创建成功
3. 测试订单创建（验证不再触发内存 fallback）
4. 重新生成 TypeScript types

**Day 1: 安全修复**
1. 创建 migration 添加 `customer_access_token` 字段
2. 创建 migration 修复 RLS 策略（移除 `USING (true)`）
3. 应用 migrations
4. 验证新 RLS 策略生效

**Day 2: 代码更新**
1. 更新 `app/actions/order.ts` 生成 access token
2. 更新 `CheckoutPageView.tsx` 在 URL 中包含 token
3. 更新 `lib/storefront/service.ts` 验证 token
4. 更新订单确认页面验证 token
5. 移除内存 fallback 代码
6. 端到端测试

**Day 3-4: 商家订单管理**
1. 创建 `order-management.ts` actions
2. 创建商家订单列表页面
3. 创建商家订单详情页面
4. 实现订单状态更新功能
5. 测试商家订单管理

**Day 5: 验证与清理**
1. 安全测试（枚举攻击、跨店访问）
2. 功能测试（完整下单流程）
3. 边缘情况测试（商品删除、价格变化）
4. 移除所有 demo 代码
5. 性能测试

**关键里程碑**:
- ✅ Day 1 结束: 订单持久化到 DB
- ✅ Day 2 结束: 安全的匿名订单访问
- ✅ Day 4 结束: 商家可以管理订单
- ✅ Day 5 结束: 生产就绪的订单系统

---

## Appendix A: Migration Checklist

### Required Migrations

- [x] `20260819_000001_create_orders_and_order_items.sql` (EXISTS, needs to be applied)
- [ ] `20260908_000001_add_order_access_token.sql` (NEW - needs to be created)
- [ ] `20260908_000002_fix_order_rls.sql` (NEW - needs to be created)

### Optional Migrations

- [ ] `20260908_000003_add_order_status_check.sql` (NEW - status validation)
- [ ] `20260908_000004_add_order_updated_at_trigger.sql` (NEW - auto-update timestamp)

---

## Appendix B: Code Change Checklist

### Required Code Changes

- [ ] Remove `memoryOrders` Map from `app/actions/order.ts`
- [ ] Remove `DEMO_PRODUCTS` constant from `app/actions/order.ts`
- [ ] Generate access token in `submitOrderInquiryAction`
- [ ] Return access token in response
- [ ] Update `CheckoutPageView.tsx` to include token in URL
- [ ] Update `getOrderById` to accept token parameter
- [ ] Update order confirmation page to validate token
- [ ] Update `getOrderConfirmationAction` to query DB only

### Optional Code Changes

- [ ] Create `app/actions/order-management.ts`
- [ ] Create `app/dashboard/orders/page.tsx`
- [ ] Create `app/dashboard/orders/[orderId]/page.tsx`
- [ ] Add order status validation helper
- [ ] Add order status transition helper

---

## Appendix C: Testing Checklist

### Security Tests

- [ ] Test order enumeration attack (should fail)
- [ ] Test cross-store order access (should fail)
- [ ] Test invalid token access (should fail)
- [ ] Test expired token access (should fail if implemented)
- [ ] Test merchant can view own orders (should succeed)
- [ ] Test merchant cannot view other stores' orders (should fail)

### Functional Tests

- [ ] Test anonymous checkout (should succeed)
- [ ] Test order confirmation with valid token (should succeed)
- [ ] Test order confirmation with invalid token (should fail)
- [ ] Test order persistence across server restart (should succeed)
- [ ] Test merchant order list (should succeed)
- [ ] Test merchant order status update (should succeed)

### Edge Case Tests

- [ ] Test order with deleted product (should show snapshot)
- [ ] Test order with deleted variant (should show snapshot)
- [ ] Test order with price change (should show snapshot)
- [ ] Test order with product name change (should show snapshot)
- [ ] Test empty cart checkout (should fail)
- [ ] Test invalid store checkout (should fail)

---

## Conclusion

The current Omnilink order system has a **solid foundation** but requires **critical fixes** before production:

1. **Apply the existing migration** to enable persistent order storage
2. **Fix the RLS security flaw** to prevent order enumeration attacks
3. **Implement access token validation** for secure anonymous order access
4. **Remove the memory fallback** to ensure data persistence

The **data model is already well-designed** with proper snapshots and minimal fields. The **price trust boundary is already correct** with server-side recalculation. The **merchant auth pattern is already established** and can be reused for order management.

With the recommended implementation order, Omnilink can transition from a demo system to a **production-ready order system** in approximately 5 days.
