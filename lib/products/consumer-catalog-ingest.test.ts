import { describe, expect, it } from 'vitest'
import { canonicalProductUrl, normalizeScrapedProduct } from './consumer-catalog-ingest'

describe('scraped product normalization', () => {
  const url = 'https://store.example/products/pearl-necklace?variant=2&utm_source=test'
  const captured = '2026-11-19T10:00:00.000Z'

  it('uses the product matching the requested URL, preserving its verified fields', () => {
    const html = `<script type="application/ld+json">${JSON.stringify([
      {'@type':'Product',url:'/products/other',name:'Recommended ring'},
      {'@type':'Product',url:'/products/pearl-necklace?variant=2',name:'Pearl Necklace',
        brand:{name:'Example'},description:'<p>Freshwater pearl</p><script>ignore()</script>',image:'/pearl.jpg',
        offers:{price:'129.00',priceCurrency:'USD',availability:'https://schema.org/OutOfStock'}},
    ]).replace(/</g, '\\u003c')}</script>`
    const product = normalizeScrapedProduct(html, url, captured)
    expect(product).toMatchObject({name:'Pearl Necklace',storeName:'Example',price:129,currency:'USD',
      priceMode:'amount',mainImage:'https://store.example/pearl.jpg',category:'项链',
      shortDescription:'Freshwater pearl',sourceUrl:'https://store.example/products/pearl-necklace?variant=2',
      catalogEvidence:{stockStatus:'sold_out_snapshot',deliveryToChina:'unverified'}})
    expect(normalizeScrapedProduct(html, url.replace('&utm_source=test', ''), captured).id).toBe(product.id)
    expect(normalizeScrapedProduct(html, url.replace('variant=2', 'variant=3'), captured).id).not.toBe(product.id)
  })

  it('reads microdata without inventing an absent currency', () => {
    const html = `<div itemscope itemtype="https://schema.org/Product">
      <span itemprop="name">Simple Earrings</span><meta itemprop="price" content="49.99">
      <img itemprop="image" src="/earrings.jpg"></div>`
    expect(normalizeScrapedProduct(html, url, captured)).toMatchObject({name:'Simple Earrings',price:0,
      priceMode:'unknown',formattedPrice:'待核价',mainImage:'https://store.example/earrings.jpg'})
  })

  it.each(['http://store.example/item','https://127.0.0.1/item','https://shop.local/item','https://user:pass@store.example/item','invalid'])
  ('rejects a non-public product URL: %s', (value) => {
    expect(() => canonicalProductUrl(value)).toThrow('PRODUCT_URL_INVALID')
  })
  it('requires a product name', () => {
    expect(() => normalizeScrapedProduct('<html></html>', url, captured)).toThrow('PRODUCT_NAME_MISSING')
  })
})
