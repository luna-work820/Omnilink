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
const product={...readConsumerCatalog().find((item)=>item.itemType==='product')!,name:'项链',category:'首饰'}
const catalog=catalogSnapshot([product])
const report={requestedMode:'keyword' as const,effectiveMode:'keyword' as const,profile:null,degraded:false,reason:null,
  embeddingCalls:0,embeddingInputTokens:0,embeddingMs:0,retrievalMs:0,candidateCount:1,keywordCount:1,semanticCount:0,totalMs:0}

beforeEach(()=>{
  vi.clearAllMocks()
  m.catalog.mockReset().mockResolvedValue(catalog)
  m.retrieve.mockResolvedValue({products:[product],report,catalogVersion:catalog.version})
})

describe('initial discovery page',()=>{
  it('returns the prepared page after an atomic commit without a second database write',async()=>{
    const commit=vi.fn().mockResolvedValue(true)
    const page=await startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog,commit)
    expect(commit).toHaveBeenCalledOnce()
    expect(commit.mock.calls[0][0].id).toBe(page.searchRunId)
    expect(commit.mock.calls[0][1]).toEqual(page)
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('uses the original save when the atomic function is unavailable',async()=>{
    m.rpc.mockReturnValue({abortSignal:async()=>({data:'saved',error:null})})
    const page=await startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog,async()=>false)
    expect(m.rpc).toHaveBeenCalledWith('create_consumer_discovery_run',expect.objectContaining({p_record:expect.objectContaining({id:page.searchRunId})}))
  })
  it('checks the current catalog before saving and returns the verified snapshot',async()=>{
    m.rpc.mockReturnValue({abortSignal:async()=>({data:'saved',error:null})})
    const page=await startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog)
    expect(m.catalog).toHaveBeenCalledOnce()
    expect(m.rpc).toHaveBeenCalledWith('create_consumer_discovery_run',expect.anything())
    expect(page.products.map((item)=>item.id)).toEqual([product.id])
  })
  it('does not save a search if the catalog changed while retrieving',async()=>{
    m.catalog.mockResolvedValueOnce(catalogSnapshot([{...product,name:`${product.name} updated`}]))
    const commit=vi.fn().mockResolvedValue(true)
    await expect(startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog,commit)).rejects.toMatchObject({code:'SEARCH_EXPIRED'})
    expect(commit).not.toHaveBeenCalled()
    expect(m.rpc).not.toHaveBeenCalled()
  })
  it('does not save a search if the catalog cannot be checked',async()=>{
    m.catalog.mockRejectedValueOnce(new Error('catalog unavailable'))
    const commit=vi.fn().mockResolvedValue(true)
    await expect(startDiscovery(actor,keywordSearchSpec('项链'),context,undefined,undefined,catalog,commit)).rejects.toThrow('catalog unavailable')
    expect(commit).not.toHaveBeenCalled()
    expect(m.rpc).not.toHaveBeenCalled()
  })
})
