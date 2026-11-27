import type { FeedItem, ProductItem } from '@/components/consumer-market/types'

export function interleaveDiscoveryFeed(items: FeedItem[]): FeedItem[] {
  const products = items.filter((item) => item.type === 'product')
  const posts = items.filter((item) => item.type === 'scene')
  const result: FeedItem[] = []
  let nextPost = 0
  products.forEach((product, index) => {
    result.push(product)
    if ((index + 1) % 3 === 0 && nextPost < posts.length) result.push(posts[nextPost++])
  })
  return [...result, ...posts.slice(nextPost)]
}

export function rankDiscoveryFeed(
  items: FeedItem[],
  products: ProductItem[],
  savedProductIds: string[],
  rejectedProductIds: string[],
): FeedItem[] {
  const saved = products.filter((product) => savedProductIds.includes(product.id))
  const rejected = new Set(rejectedProductIds)
  const categories = new Set(saved.map((product) => product.category).filter(Boolean))
  const addedAt = (product: ProductItem) => {
    const value = product.catalogAddedAt ?? product.sourceDate
    const timestamp = value ? Date.parse(value) : Number.NEGATIVE_INFINITY
    return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY
  }
  const scoreProduct = (product: ProductItem) => {
    if (rejected.has(product.id)) return -100
    if (savedProductIds.includes(product.id)) return 2
    return categories.has(product.category) ? 1 : 0
  }

  return items.map((item, index) => ({ item, index,
    addedAt: item.type === 'product' ? addedAt(item.product) : Number.NEGATIVE_INFINITY,
    score: item.type === 'product'
      ? scoreProduct(item.product)
      : Math.max(0, ...item.scenePost.linkedProducts.map(scoreProduct)) }))
    .sort((a, b) => b.addedAt - a.addedAt || b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}
