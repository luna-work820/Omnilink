import { beforeEach, describe, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({store:vi.fn(),products:vi.fn(),product:vi.fn(),generated:vi.fn()}))
vi.mock('server-only',()=>({}))
vi.mock('@/lib/site-builder/data',()=>({readGeneratedStoreState:m.generated}))
vi.mock('@/lib/storefront/service',()=>({getPublishedStore:m.store,getStorefrontProducts:m.products,getStorefrontProduct:m.product}))
import { GET as list } from '@/app/api/site-data/v1/[storeSlug]/products/route'
import { GET as detail } from '@/app/api/site-data/v1/[storeSlug]/products/[productId]/route'
import { GET as readStore } from '@/app/api/site-data/v1/[storeSlug]/route'
const store={id:'store-id',slug:'store-a',name:'A',description:null,logoUrl:null,currency:'CNY',themeId:null}
const product={id:'product-a',slug:'product-a',name:'A',description:null,price:99,priceMode:'amount',currency:'CNY',imageUrl:null,attributes:{},href:'/store/store-a/products/product-a'}
const params=()=>({params:Promise.resolve({storeSlug:'store-a'})})
beforeEach(()=>{vi.resetAllMocks();m.generated.mockResolvedValue({managed:false,store:null});m.store.mockResolvedValue(store);m.products.mockResolvedValue([product]);m.product.mockResolvedValue(product)})
describe('public site data routes',()=>{
 it('reads the published store and scopes pagination to that store',async()=>{
  m.products.mockResolvedValue([product,{...product,id:'b'},{...product,id:'c'}])
  const result=await list(new Request('https://example.com/api?limit=2&offset=4'),params())
  expect(result.status).toBe(200);expect(result.headers.get('cache-control')).toBe('no-store')
  expect(m.products).toHaveBeenCalledWith(store,3,4)
  const data=await result.json();expect(data.items).toHaveLength(2);expect(data.nextOffset).toBe(6);expect(data.items[0]).not.toHaveProperty('href')
 })
 it('returns no public products for an unpublished store',async()=>{
  m.store.mockResolvedValue(null)
  const result=await list(new Request('https://example.com/api'),params())
  expect(result.status).toBe(404);expect(m.products).not.toHaveBeenCalled()
 })
 it('excludes legacy demo fallbacks from the real-data protocol',async()=>{
  m.store.mockResolvedValue({...store,id:'demo-store'})
  expect((await readStore(new Request('https://example.com/api'),params())).status).toBe(404)
  expect(m.products).not.toHaveBeenCalled()
 })
 it('queries details through store ownership/publication filtering and handles absent products',async()=>{
  m.product.mockResolvedValue(null)
  const result=await detail(new Request('https://example.com/api'),{params:Promise.resolve({storeSlug:'store-a',productId:'other-store-product'})})
  expect(m.product).toHaveBeenCalledWith(store,'other-store-product');expect(result.status).toBe(404)
 })
 it.each(['limit=0','limit=51','limit=1.5','offset=-1','offset=100001','limit=1&limit=2','storeId=other','includeDrafts=true'])('rejects query %s before any data request',async(query)=>{
  const result=await list(new Request('https://example.com/api?'+query),params())
  expect(result.status).toBe(400);expect(m.store).not.toHaveBeenCalled()
 })
 it('does not resurrect legacy publication when the managed website is unpublished',async()=>{
  m.generated.mockResolvedValue({managed:true,store:null})
  const result=await readStore(new Request('https://example.com/api'),params())
  expect(result.status).toBe(404);expect(m.store).not.toHaveBeenCalled()
 })
 it('does not expose provider/database errors',async()=>{
  m.products.mockRejectedValue(new Error('secret database connection details'))
  const result=await list(new Request('https://example.com/api'),params())
  expect(result.status).toBe(503);expect(await result.text()).not.toContain('secret')
 })
 it('does not return management-only store fields',async()=>{
  const result=await readStore(new Request('https://example.com/api'),params());const data=await result.json()
  expect(data.store).not.toHaveProperty('id');expect(data.store).not.toHaveProperty('themeId');expect(data.store.slug).toBe('store-a')
 })
})
