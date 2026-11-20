import { describe, expect, it } from 'vitest'
import { productsList } from '@/components/consumer-market/data/mockData'
import type { FeedItem, ProductItem } from '@/components/consumer-market/types'
import { interleaveDiscoveryFeed, rankDiscoveryFeed } from './discovery-ranking'
import { publicationDefaults, publicationScene } from '@/lib/creator-publication-document'

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
  it('keeps each publication visible once, including feeds without catalog products', () => {
    const posts: FeedItem[] = ['one', 'two', 'three'].map((id) => ({ type: 'scene', scenePost: publicationScene(id, { version: 1, kind: 'image', fields: { ...publicationDefaults, title: id }, media: ['https://example.com/image.webp'], coverUrl: 'https://example.com/image.webp', excerpt: '' }, '测试创作者') }))
    expect(interleaveDiscoveryFeed(posts)).toEqual(posts)
    const mixed = interleaveDiscoveryFeed([...items, ...posts])
    expect(mixed.filter((item) => item.type === 'scene')).toEqual(posts)
    expect(mixed.filter((item) => item.type === 'product')).toEqual(items)
  })
})
