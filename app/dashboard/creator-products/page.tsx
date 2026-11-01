import { CreatorSelectionLibrary } from '@/components/creator-content/CreatorSelectionLibrary'
import { collectedDemoProducts } from '@/components/consumer-market/data/mockData'
import type { ProductItem } from '@/components/consumer-market/types'
import { getStorefrontDiscoveryItems } from '@/lib/storefront/service'
import { createClientServer } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

function toSelectionItem(item: Awaited<ReturnType<typeof getStorefrontDiscoveryItems>>[number]): ProductItem {
  const { product, store } = item
  const currency = product.currency || 'CNY'
  let formattedPrice = `${currency} ${product.price.toLocaleString('zh-CN')}`
  try {
    formattedPrice = new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(product.price)
  } catch {
    // Keep the explicit currency fallback for non-ISO values.
  }
  return {
    id: product.id,
    name: product.name,
    creator: store.name,
    price: product.price,
    formattedPrice: product.priceMode === 'inquiry' ? '询价' : product.priceMode === 'free' || product.price === 0 ? '免费' : formattedPrice,
    outboundLinks: product.outboundLinks,
    mainImage: product.imageUrl || '/consumer-market/product-image-pending.svg',
    aspectRatio: 0.8,
    secondaryImages: product.images ?? [],
    category: product.attributes.category || '精选商品',
    shortDescription: product.description || '',
    aiSummary: product.description || '',
    reviews: [],
    specs: product.attributes,
    storeName: store.name,
    currency,
  }
}

export default async function CreatorProductsPage() {
  const supabase = await createClientServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.app_metadata?.creator_enabled !== true) redirect('/dashboard')
  let items: ProductItem[] = []
  try {
    items = (await getStorefrontDiscoveryItems(100)).map(toSelectionItem)
  } catch (error) {
    console.warn('[CreatorSelectionLibrary] Public products unavailable.', error)
  }
  if (!user && process.env.NODE_ENV !== 'production' && items.length === 0) {
    items = collectedDemoProducts.slice(0, 32)
  }
  return <CreatorSelectionLibrary items={items} />
}
