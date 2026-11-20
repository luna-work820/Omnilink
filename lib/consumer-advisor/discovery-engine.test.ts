import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({rpc:vi.fn(),catalog:vi.fn(),retrieve:vi.fn()}))
vi.mock('@/lib/supabase/service-role',()=>({createServiceRoleClient:()=>({rpc:m.rpc})}))
vi.mock('@/lib/products/consumer-catalog-store',async(original)=>({...await original<typeof import('@/lib/products/consumer-catalog-store')>(),readPublishedConsumerCatalog:m.catalog}))
vi.mock('./discovery-retrieval',()=>({retrieveDiscoveryCandidates:m.retrieve}))

import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
import { catalogSnapshot } from '@/lib/products/consumer-catalog-store'
import { startDiscovery } from './discovery-engine'
import { keywordSearchSpec } from './search-spec'

const actor={userId:null,guestHash:'a'.repeat(64),sessionId:'20000000-0000-4000-8000-000000000001'}
const context={userId:null,version:0,memories:[]}
const product=readConsumerCatalog()[0]
const catalog=catalogSnapshot([product])
const report={requestedMode:'keyword' as const,effectiveMode:'keyword' as const,profile:null,degraded:false,reason:null,
  embeddingCalls:0,embeddingInputTokens:0,embeddingMs:0,retrievalMs:0,candidateCount:1,keywordCount:1,semanticCount:0,totalMs:0}

beforeEach(()=>{
  vi.clearAllMocks()
  m.catalog.mockReset().mockResolvedValue(catalog)
  m.retrieve.mockResolvedValue({products:[product],report,catalogVersion:catalog.version})
})

describe('initial discovery page',()=>{
  it('reads the latest catalog while creating the owned search, then validates the stored search',async()=>{
    let release:(value:unknown)=>void=()=>{}
    let record:Record<string,any>={}
    m.rpc.mockImplementation((name:string,args:Record<string,any>)=>{
      if(name==='create_consumer_discovery_run') {
        record=args.p_record
        return {abortSignal:()=>new Promise((resolve)=>{release=resolve})}
      }
      return {abortSignal:async()=>({data:{id:record.id,spec:record.spec,sessionId:record.session_id,
        contextVersion:record.context_version,expiresAt:record.expires_at,execution:record.execution},error:null})}
    })
    const pending=startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog)
    await vi.waitFor(()=>expect(m.rpc).toHaveBeenCalledWith('create_consumer_discovery_run',expect.anything()))
    const catalogStarted=m.catalog.mock.calls.length
    release({data:record.id,error:null})
    const page=await pending
    expect(catalogStarted).toBe(1)
    expect(m.rpc).toHaveBeenCalledWith('read_consumer_discovery_execution',expect.objectContaining({p_session_id:actor.sessionId,p_guest_hash:actor.guestHash}))
    expect(page.products.map((item)=>item.id)).toEqual([product.id])
  })
  it('rejects the first page if the published catalog changed while retrieving',async()=>{
    let record:Record<string,any>={}
    m.catalog.mockResolvedValueOnce(catalogSnapshot([{...product,name:`${product.name} updated`}]))
    m.rpc.mockImplementation((name:string,args:Record<string,any>)=>{
      if(name==='create_consumer_discovery_run') {
        record=args.p_record
        return {abortSignal:async()=>({data:record.id,error:null})}
      }
      return {abortSignal:async()=>({data:{id:record.id,spec:record.spec,sessionId:record.session_id,
        contextVersion:record.context_version,expiresAt:record.expires_at,execution:record.execution},error:null})}
    })
    await expect(startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog)).rejects.toMatchObject({code:'SEARCH_EXPIRED'})
  })
  it('handles a failed concurrent catalog read when creating the search also fails',async()=>{
    m.catalog.mockRejectedValueOnce(new Error('catalog unavailable'))
    m.rpc.mockReturnValue({abortSignal:async()=>({data:null,error:{message:'unavailable'}})})
    await expect(startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog)).rejects.toMatchObject({code:'CATALOG_UNAVAILABLE'})
  })
})
