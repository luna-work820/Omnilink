import { describe, expect, it } from 'vitest'
import { catalogFallback } from './catalog-fallback'

const catalog = [
  { id: 'lamp', name: '弧形台灯', category: '灯光照明' },
  { id: 'chair', name: '实木椅子', category: '家具' },
  { id: 'desk', name: '书桌椅', category: '家具' },
  { id: 'shampoo', name: '洗发露 400mL', category: '个护美妆' },
]

describe('catalogFallback', () => {
  it('does not turn ordinary chat into a product recommendation', () => {
    expect(catalogFallback('你好', catalog, [], [])).toBeNull()
    expect(catalogFallback('台灯', catalog, [], [])?.matchedProductIds).toEqual(['lamp'])
  })

  it('selects a catalog match and respects an explicit rejection', () => {
    expect(catalogFallback('想找一盏台灯', catalog, [], [])?.matchedProductIds).toEqual(['lamp'])
    expect(catalogFallback('想找一盏台灯', catalog, [], ['lamp'])?.matchedProductIds).toEqual([])
    expect(catalogFallback('想找一盏台灯', catalog, ['chair'], [])?.matchedProductIds).toEqual(['lamp'])
  })

  it('uses the requested item rather than context or budget digits', () => {
    expect(catalogFallback('为书桌找一盏300元以内的台灯', catalog, [], [])?.matchedProductIds).toEqual(['lamp'])
  })
})
