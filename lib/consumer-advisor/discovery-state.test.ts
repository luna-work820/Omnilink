import { describe,expect,it } from 'vitest'
import { applyDiscoveryPage } from './discovery-state'
import { discoverySpecSchema,readDiscoveryReference,type DiscoveryPage } from './discovery-contract'
import { productsList } from '@/components/consumer-market/data/mockData'

const page:DiscoveryPage={searchRunId:crypto.randomUUID(),sessionId:crypto.randomUUID(),query:'沙发',products:productsList.slice(0,2),
  nextCursor:'next',contextVersion:3,snapshotVersion:1,pageSize:20,returnedCount:2,candidateCount:3,question:null,
  spec:discoverySpecSchema.parse({query:'沙发',termGroups:[['沙发']]})}
describe('discovery client state',()=>{
  it('appends only to the same session, run and preference version, preserving order and deduplicating IDs',()=>{
    const next={...page,products:productsList.slice(1,3),nextCursor:null}
    expect(applyDiscoveryPage(page,next,true)?.products.map((p)=>p.id)).toEqual(productsList.slice(0,3).map((p)=>p.id))
    expect(applyDiscoveryPage(page,{...next,sessionId:crypto.randomUUID()},true)).toBe(page)
    expect(applyDiscoveryPage(page,{...next,searchRunId:crypto.randomUUID()},true)).toBe(page)
    expect(applyDiscoveryPage(page,{...next,contextVersion:4},true)).toBe(page)
  })
  it('restores a small validated reference instead of persisting product pages in chat history',()=>{
    const reference={searchRunId:page.searchRunId,contextVersion:3,spec:page.spec}
    expect(readDiscoveryReference([{type:'discovery_feed',data:{...reference,products:productsList}}])).toEqual(reference)
    expect(readDiscoveryReference([{type:'discovery_feed',data:{searchRunId:'invalid'}}])).toBeUndefined()
    expect(readDiscoveryReference({type:'discovery_feed',data:reference})).toBeUndefined()
  })
})
