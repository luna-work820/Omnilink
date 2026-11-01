import { Suspense } from 'react'
import { createClientServer } from '@/lib/supabase/server'
import { getStoreByOwnerId } from '@/lib/stores/service'
import { type ProductRow } from '@/components/product/ProductTable'
import { ProductsView } from '@/components/product/ProductsView'
import { ProductsSkeleton } from '@/components/product/ProductsSkeleton'
import { DEMO_PRODUCTS } from '@/lib/products/demo-data'
import { listingTypeFromCatalog } from '@/lib/products/listing-type'

const PRODUCT_SELECT = 'id, item_type, title, description, cover_image, details, status, created_at, catalog_variants(id, sku_code, price, currency_code, availability_type, availability_value), catalog_media(storage_path, media_role)'

function mapDbProductToRow(db: Record<string, any>): ProductRow {
  const raw = db.details && typeof db.details === 'object' ? db.details : {}
  const category =
    (typeof raw.category === 'string' && raw.category.trim() ? raw.category : null) ||
    (typeof raw.category_id === 'string' && raw.category_id.trim() ? raw.category_id : null) ||
    null

  const imageUrl =
    (Array.isArray(db.catalog_media) && db.catalog_media[0]?.storage_path ? db.catalog_media[0].storage_path : null) ||
    (typeof db.cover_image === 'string' && db.cover_image.trim() ? db.cover_image : null) ||
    null

  return {
    id: db.id,
    listingType: listingTypeFromCatalog(db.item_type, raw.delivery_type),
    name: db.title ?? '',
    category,
    price: db.catalog_variants?.[0]?.price ?? null,
    inventory: db.catalog_variants?.[0]?.availability_type === 'stock' ? db.catalog_variants?.[0]?.availability_value ?? 0 : null,
    image_url: imageUrl,
    semantic_data: null,
    sku: db.catalog_variants?.[0]?.sku_code ?? null,
    status: db.status,
    priceMode: raw.price_mode === 'inquiry' ? 'inquiry' : raw.price_mode === 'free' ? 'free' : 'amount',
    sales_count: 0,
  }
}

async function getRealProducts(storeId: string): Promise<ProductRow[]> {
  const supabase = await createClientServer()
  const { data: store } = await supabase.from('stores').select('organization_id').eq('id', storeId).single()
  if (!store) return []
  const { data: products, error } = await supabase
    .from('catalog_items')
    .select(PRODUCT_SELECT)
    .eq('organization_id', store.organization_id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error || !products) {
    return []
  }
  const { data: channel } = await supabase.from('sales_channels').select('id')
    .eq('organization_id', store.organization_id).eq('code', 'storefront').eq('channel_type', 'storefront').eq('status', 'active').limit(1).maybeSingle()
  const { data: assignments } = channel
    ? await supabase.from('catalog_item_channels').select('catalog_item_id, is_visible, is_purchasable')
      .eq('store_id', storeId).eq('channel_id', channel.id)
    : { data: [] }
  const visibleIds = new Set((assignments ?? []).filter((row) => row.is_visible).map((row) => row.catalog_item_id))
  return products.map((product) => ({ ...mapDbProductToRow(product), consumer_visible: visibleIds.has(product.id), channel_visibility_supported: true }))
}

async function ProductsListContent() {
  const supabase = await createClientServer()
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  // Resolve store_id the exact same way as API routes (requireUser + getOwnedStore)
  let storeId: string | null = null
  if (user) {
    const store = await getStoreByOwnerId(user.id).catch(() => null)
    storeId = store?.id ?? null
  }

  const dbProducts = storeId ? await getRealProducts(storeId) : []

  const demoRows: ProductRow[] = DEMO_PRODUCTS.map((product) => ({
    id: product.id,
    listingType: 'product',
    name: product.name,
    category: product.category,
    price: product.price,
    inventory: product.inventory,
    image_url: product.image_url,
    semantic_data: product.semantic_data,
    sku: product.sku,
    status: product.status,
    sales_count: product.sales_count,
  }))

  return <ProductsView products={dbProducts.length > 0 ? dbProducts : demoRows} />
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsListContent />
    </Suspense>
  )
}
