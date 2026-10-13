import App from '@/components/consumer-market/App'
import { productsList } from '@/components/consumer-market/data/mockData'
import type { ProductItem } from '@/components/consumer-market/types'
import { getStorefrontDiscoveryItems } from '@/lib/storefront/service'

export const metadata = {
  title: 'Omnilink 灵感市场',
  description: '浏览商家发布的商品与空间灵感。',
}

function toConsumerProduct(
  item: Awaited<ReturnType<typeof getStorefrontDiscoveryItems>>[number]
): ProductItem {
  const { product, store } = item
  const image = product.imageUrl || '/consumer-market/img_app_icon.jpg'
  const currency = product.currency || 'CNY'
  let formattedPrice = `${currency} ${product.price.toLocaleString('zh-CN')}`
  try {
    formattedPrice = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(product.price)
  } catch {
    // Keep the explicit currency fallback for non-ISO currency values.
  }

  return {
    id: product.id,
    name: product.name,
    creator: store.name,
    price: product.price,
    formattedPrice,
    mainImage: image,
    aspectRatio: 0.82,
    secondaryImages: (product.images ?? []).filter((url) => url !== image),
    category: product.attributes.category || product.attributes.category_name || '精选商品',
    shortDescription: product.description || '',
    aiSummary: product.description || '商品信息由商家工作台维护。',
    reviews: [],
    specs: product.attributes,
    storeName: store.name,
    storeImage: undefined,
    contextStory: product.description || undefined,
    currency,
    storeSlug: store.slug,
    defaultVariantId: product.variants?.find((variant) => variant.status === 'active')?.id ?? product.variants?.[0]?.id ?? null,
  }
}

export default async function ConsumerMarketPage() {
  let initialProducts: ProductItem[] = productsList.map((product) => ({
    ...product,
    storeSlug: 'omnilink-flagship',
    currency: 'CNY',
  }))
  let hasLiveProducts = false

  try {
    const liveItems = await getStorefrontDiscoveryItems()
    if (liveItems.length) {
      initialProducts = liveItems.map(toConsumerProduct)
      hasLiveProducts = true
    }
  } catch (error) {
    console.warn('[ConsumerMarket] Published catalog unavailable; showing bundled market data.', error)
  }

  return <App initialProducts={initialProducts} hasLiveProducts={hasLiveProducts} />
}
