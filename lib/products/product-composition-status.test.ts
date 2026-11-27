import { describe, expect, it } from 'vitest'
import { resolveProductComposition } from './product-composition'

const empty = { kind: 'unknown' as const, status: 'not_applicable' as const, items: [] }

describe('composition status for physical items', () => {
  it.each(['品牌商品/成分护肤', '品牌商品/高端洗护', '品牌商品/新中式', '服饰'])('treats missing information as not provided for %s', category => {
    expect(resolveProductComposition({ itemType: 'product', deliveryType: 'physical', category, composition: empty }).status).toBe('not_provided')
  })
  it('corrects legacy scraped rows that predate itemType and deliveryType', () => {
    expect(resolveProductComposition({ category: '品牌商品/成分护肤', composition: empty }).status).toBe('not_provided')
    expect(resolveProductComposition({ category: '电子设备', composition: empty }).status).toBe('not_applicable')
  })
  it('keeps services, digital items and non-targeted physical items unchanged', () => {
    expect(resolveProductComposition({ itemType: 'service', deliveryType: 'physical', category: '洗护', composition: empty }).status).toBe('not_applicable')
    expect(resolveProductComposition({ itemType: 'product', deliveryType: 'digital', category: '服饰', composition: empty }).status).toBe('not_applicable')
    expect(resolveProductComposition({ itemType: 'product', deliveryType: 'physical', category: '电子设备', composition: empty }).status).toBe('not_applicable')
  })
  it('preserves sourced ingredient records', () => {
    const composition = { kind: 'cosmetic-inci' as const, status: 'verified' as const, items: [{ name: 'Water', position: 1 }], sourceUrl: 'https://example.com' }
    expect(resolveProductComposition({ itemType: 'product', deliveryType: 'physical', category: '洗护', composition })).toMatchObject(composition)
  })
})
