import { describe, expect, it } from 'vitest'
import { productsList } from '@/components/consumer-market/data/mockData'
import type { FeedItem, ProductItem } from '@/components/consumer-market/types'
import { rankDiscoveryFeed } from './discovery-ranking'

const base = productsList[0]
const product = (id: string, category: string): ProductItem => ({
  ...base,
  id,
  category,
  creator: id,
  storeName: id,
})

describe('rankDiscoveryFeed', () => {
  const liked = product('liked', '灯具')
  const similar = product('similar', '灯具')
  const other = product('other', '服饰')
  const items: FeedItem[] = [other, similar, liked].map((item) => ({ type: 'product', product: item }))

  it('preserves catalog order without explicit signals', () => {
    expect(rankDiscoveryFeed(items, [liked, similar, other], [], [])).toEqual(items)
  })

  it('brings related products forward and demotes explicitly rejected products', () => {
    const ranked = rankDiscoveryFeed(items, [liked, similar, other], ['liked'], ['liked'])
    expect(ranked.map((item) => item.type === 'product' && item.product.id)).toEqual(['similar', 'other', 'liked'])
  })
})
