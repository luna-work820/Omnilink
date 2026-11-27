import { describe, expect, it } from 'vitest'
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
import { discoverySpecSchema } from './discovery-contract'
import { isDiscoveryPlaceholderImage } from './discovery-placeholder'
import { eligibleConsumerProduct } from './search-spec'

describe('discovery placeholder images', () => {
  it('excludes known storefront icons and pending images from search results', () => {
    const ids = ['tbb-brand-el-reverb', 'tbp-reverb-5', 'tbp-reverb-7', 'tbp-thomann-gb-1', 'neo-brand-nc-zhuchongyun']
    const products = readConsumerCatalog(ids)
    const spec = discoverySpecSchema.parse({ query: '商品', termGroups: [] })

    expect(products).toHaveLength(ids.length)
    expect(products.every((product) => isDiscoveryPlaceholderImage(product.mainImage))).toBe(true)
    expect(products.every((product) => !eligibleConsumerProduct(product, spec))).toBe(true)
  })

  it('keeps ordinary product photographs even when their filenames mention trucks', () => {
    expect(isDiscoveryPlaceholderImage('https://example.com/products/truck-toy.jpg')).toBe(false)
    expect(isDiscoveryPlaceholderImage('https://images.reverb.com/image/upload/guitar.jpg')).toBe(false)
    expect(isDiscoveryPlaceholderImage(undefined)).toBe(false)
  })
})
