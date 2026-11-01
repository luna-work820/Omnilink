import type { FeedItem, ProductItem } from '@/components/consumer-market/types'

export function rankDiscoveryFeed(
  items: FeedItem[],
  products: ProductItem[],
  savedProductIds: string[],
  rejectedProductIds: string[],
): FeedItem[] {
  if (!savedProductIds.length && !rejectedProductIds.length) return items

  const saved = products.filter((product) => savedProductIds.includes(product.id))
  const rejected = new Set(rejectedProductIds)
  const categories = new Set(saved.map((product) => product.category).filter(Boolean))
  const scoreProduct = (product: ProductItem) => {
    if (rejected.has(product.id)) return -100
    if (savedProductIds.includes(product.id)) return 2
    return categories.has(product.category) ? 1 : 0
  }

  return items.map((item, index) => ({ item, index, score: item.type === 'product'
    ? scoreProduct(item.product)
    : Math.max(0, ...item.scenePost.linkedProducts.map(scoreProduct)) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}
