import { describe, expect, it } from 'vitest'
import { sitePriceSchema, siteProductSchema, siteStoreSchema } from './contracts'
import { projectSiteProduct, projectSiteStore } from './projection'
import { formatSitePrice } from './sdk'
import { normalizeProduct, type StorefrontProductRow } from '@/lib/storefront/normalize'
import type { StorefrontProduct, StorefrontStore } from '@/lib/storefront/types'

const product: StorefrontProduct = {
  id:'product-a',slug:'product-a',name:'银色项链',price:199,priceMode:'amount',currency:'CNY',
  imageUrl:'https://cdn.example.com/a.jpg',description:'真实商品介绍',href:'/store/store-a/products/product-a',attributes:{材质:'银'},
}
const store: StorefrontStore={id:'private-store-id',slug:'store-a',name:'店铺 A',description:null,logoUrl:null,currency:'CNY',themeId:'minimal'}
describe('site data contract',()=>{
 it('projects only public fields, not private IDs, stock, SKU or internal metadata',()=>{
  const data=projectSiteProduct({...product,variants:[{id:'sku-a',sku:'internal',inventory:4,price:199,optionValues:{}}]})
  expect(siteProductSchema.safeParse(data).success).toBe(true)
  expect(data.variants[0].availability).toBe('available');expect(data.variants[0]).not.toHaveProperty('inventory');expect(data.variants[0]).not.toHaveProperty('sku');expect(data).not.toHaveProperty('href');expect(data).not.toHaveProperty('currency')
  const publicStore=projectSiteStore(store);expect(publicStore).not.toHaveProperty('id');expect(publicStore).not.toHaveProperty('themeId')
 })
 it('keeps zero amount distinct from free, inquiry and unknown',()=>{
  expect(projectSiteProduct({...product,price:0}).price).toEqual({kind:'amount',amount:0,currency:'CNY'})
  expect(projectSiteProduct({...product,priceMode:'free'}).price).toEqual({kind:'free'})
  expect(projectSiteProduct({...product,priceMode:'inquiry'}).price).toEqual({kind:'inquiry'})
  expect(projectSiteProduct({...product,priceMode:'unknown'}).price).toEqual({kind:'unknown'})
  expect(formatSitePrice({kind:'unknown'})).toBe('价格待确认');expect(formatSitePrice({kind:'free'})).toBe('免费')
 })
 it.each([NaN,Infinity,-5])('does not invent an amount for invalid price %s',(price)=>{
  expect(projectSiteProduct({...product,price}).price).toEqual({kind:'unknown'})
 })
 it('does not assume a price when upstream has not supplied its mode or currency',()=>{
  expect(projectSiteProduct({...product,priceMode:undefined}).price.kind).toBe('unknown')
  expect(projectSiteProduct({...product,currency:''}).price.kind).toBe('unknown')
 })
 it('rejects executable or credential-bearing resource URLs and unsupported outbound links',()=>{
  const data=projectSiteProduct({...product,imageUrl:'javascript:alert(1)',images:['https://user:password@cdn.example.com/a','https://cdn.example.com/b.jpg'],outboundLinks:{xiaohongshu:'https://evil.example.com'}})
  expect(data.imageUrl).toBeNull();expect(data.images).toEqual(['https://cdn.example.com/b.jpg']);expect(data.outboundLinks).toEqual([])
 })
 it('rejects contract extensions and inconsistent money shapes',()=>{
  expect(sitePriceSchema.safeParse({kind:'unknown',amount:0}).success).toBe(false)
  expect(sitePriceSchema.safeParse({kind:'amount',amount:5,currency:'cny'}).success).toBe(false)
  expect(siteStoreSchema.safeParse({...projectSiteStore(store),serviceRoleKey:'secret'}).success).toBe(false)
 })
 it.each([null,'', '  ', -1, 'bad', Infinity])('keeps missing or malformed database price %s unknown',(price)=>{
  const row={id:'a',name:'A',price,currency:'CNY',details:{}} as StorefrontProductRow
  expect(normalizeProduct(row,{storeSlug:'store-a'}).priceMode).toBe('unknown')
 })
 it('preserves explicit unknown in database details and keeps valid zero amount',()=>{
  const row:StorefrontProductRow={id:'a',name:'A',price:0,currency:'CNY',description:null,details:{}}
  expect(normalizeProduct(row,{storeSlug:'store-a'}).priceMode).toBe('amount')
  expect(normalizeProduct({...row,details:{price_mode:'unknown'}},{storeSlug:'store-a'}).priceMode).toBe('unknown')
 })
})
