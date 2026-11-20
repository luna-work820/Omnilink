import type { FeedItem, ProductItem } from '@/components/consumer-market/types'

export function interleaveDiscoveryFeed(items: FeedItem[]): FeedItem[] {
  const products = items.filter((item) => item.type === 'product')
  const posts = items.filter((item) => item.type === 'scene')
  const result: FeedItem[] = []
  let nextPost = 0
  products.forEach((product, index) => {
    if (index % 3 === 0 && nextPost < posts.length) result.push(posts[nextPost++])
    result.push(product)
  })
  return [...result, ...posts.slice(nextPost)]
}

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
