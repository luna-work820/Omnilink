import { beforeEach, describe, expect, it, vi } from 'vitest'
const m=vi.hoisted(()=>({client:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClientServer:m.client}))
import { getStorefrontProducts } from '@/lib/storefront/service'
const log:Array<{table:string;method:string;args:unknown[]}>=[]
function client(){return {from(table:string){
 const data=table==='stores'?{organization_id:'org-a'}:table==='sales_channels'?{id:'channel-a'}:table==='catalog_item_channels'?[{catalog_item_id:'visible-a'}]:[]
 const q:Record<string,unknown>={then:(resolve:(value:unknown)=>void)=>resolve({data,error:null})}
 for(const method of ['select','eq','in','order','range','limit','maybeSingle'])q[method]=(...args:unknown[])=>{log.push({table,method,args});return q}
 return q
}}}
beforeEach(()=>{vi.clearAllMocks();log.length=0;m.client.mockResolvedValue(client())})
describe('existing storefront reader used by site data',()=>{
 it('keeps organization, status and channel filtering in the database and adds bounded pagination',async()=>{
  await getStorefrontProducts({id:'store-a',slug:'shop-a'},25,50)
  expect(log).toContainEqual({table:'stores',method:'eq',args:['id','store-a']})
  expect(log).toContainEqual({table:'catalog_item_channels',method:'eq',args:['store_id','store-a']})
  expect(log).toContainEqual({table:'catalog_item_channels',method:'eq',args:['is_visible',true]})
  expect(log).toContainEqual({table:'catalog_items',method:'eq',args:['organization_id','org-a']})
  expect(log).toContainEqual({table:'catalog_items',method:'eq',args:['status','active']})
  expect(log).toContainEqual({table:'catalog_items',method:'in',args:['id',['visible-a']]})
  expect(log).toContainEqual({table:'catalog_items',method:'range',args:[50,74]})
  expect(log).toContainEqual({table:'catalog_items',method:'order',args:['id',{ascending:false}]})
 })
 it('rejects unbounded reads before creating a client',async()=>{
  await expect(getStorefrontProducts({id:'a',slug:'a'},1000,-1)).rejects.toThrow('Invalid storefront pagination')
  expect(m.client).not.toHaveBeenCalled()
 })
})
