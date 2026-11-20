import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({from:vi.fn(),rpc:vi.fn(),embed:vi.fn()}))
vi.mock('@/lib/supabase/service-role',()=>({createServiceRoleClient:()=>({from:m.from,rpc:m.rpc})}))
vi.mock('./embedding-provider',async(original)=>({...await original<typeof import('./embedding-provider')>(),embedConsumerTexts:m.embed}))
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
import { embeddingProfiles } from './embedding-profile'
import { discoverySpecSchema } from './discovery-contract'
import { indexPendingConsumerProducts,productEmbeddingDocument,searchConsumerCatalogByVector } from './consumer-catalog-vector'
const profile=embeddingProfiles['qwen-text-embedding-v4-1024-v1'],products=readConsumerCatalog().slice(0,2)
const spec=discoverySpecSchema.parse({query:'silver earrings',termGroups:[],retrieval:{mode:'semantic',profile:profile.id}})
function chain(data:unknown,error:unknown=null) {
  const value={data,error},c={select:vi.fn(),eq:vi.fn(),in:vi.fn(),abortSignal:vi.fn(),maybeSingle:vi.fn().mockResolvedValue(value),then:(done:(v:unknown)=>unknown)=>Promise.resolve(value).then(done)}
  for(const key of ['select','eq','in','abortSignal'] as const)c[key].mockReturnValue(c)
  return c
}
beforeEach(()=>{
  vi.clearAllMocks()
  m.from.mockImplementation((table:string)=>chain(table==='consumer_embedding_profiles'?{profile,status:'ready'}:
    products.map((p)=>({product_key:p.id,content_hash:productEmbeddingDocument(p).hash}))))
  m.embed.mockImplementation(async(p, texts)=>({vectors:texts.map(()=>Array(p.dimensions).fill(0.1)),calls:1,inputTokens:12,durationMs:1}))
  m.rpc.mockImplementation((name:string)=>chain(name==='match_consumer_catalog_vectors'?products.map((p)=>({product_key:p.id,similarity:0.8})):true))
})
describe('versioned consumer embeddings',()=>{
  it('binds query model, dimensions, preprocessing and version to the same indexed profile',async()=>{
    const result=await searchConsumerCatalogByVector(spec,products,profile)
    expect(result.matches.map((p)=>p.id)).toEqual(products.map((p)=>p.id))
    expect(m.embed).toHaveBeenCalledWith(profile,['silver earrings'],'query',undefined)
    expect(m.rpc).toHaveBeenCalledWith('match_consumer_catalog_vectors',expect.objectContaining({p_profile:profile,p_documents:products.map((p)=>({key:p.id,hash:productEmbeddingDocument(p).hash}))}))
  })
  it('starts the independent profile and document checks together, before embedding',async()=>{
    let release:(value:{data:unknown;error:null})=>void=()=>{}
    const profileChain=chain(null)
    profileChain.maybeSingle.mockImplementation(()=>new Promise((resolve)=>{release=resolve}))
    m.from.mockImplementation((table:string)=>table==='consumer_embedding_profiles'?profileChain:
      chain(products.map((p)=>({product_key:p.id,content_hash:productEmbeddingDocument(p).hash}))))
    const pending=searchConsumerCatalogByVector(spec,products,profile)
    expect(m.from.mock.calls.map(([table])=>table)).toEqual(['consumer_embedding_profiles','consumer_catalog_vectors'])
    expect(m.embed).not.toHaveBeenCalled()
    release({data:{profile,status:'ready'},error:null})
    expect((await pending).matches).toHaveLength(2)
  })
  it('uses the atomic vector match to validate the local index without separate reads on success',async()=>{
    const local=embeddingProfiles['bge-small-zh-v1.5-512-v1']
    m.from.mockImplementation(()=>{throw new Error('unexpected index preflight')})
    const result=await searchConsumerCatalogByVector(spec,products,local)
    expect(result.matches.map((item)=>item.id)).toEqual(products.map((item)=>item.id))
    expect(m.from).not.toHaveBeenCalled()
    expect(m.rpc).toHaveBeenCalledTimes(1)
    expect(m.rpc).toHaveBeenCalledWith('match_consumer_catalog_vectors',expect.objectContaining({p_profile:local}))
  })
  it('rejects an incomplete local match and diagnoses stale index data',async()=>{
    const local=embeddingProfiles['bge-small-zh-v1.5-512-v1']
    m.from.mockImplementation((table:string)=>chain(table==='consumer_embedding_profiles'?{profile:local,status:'ready'}:
      products.map((p,index)=>({product_key:p.id,content_hash:index?'stale':productEmbeddingDocument(p,local).hash}))))
    m.rpc.mockReturnValue(chain([{product_key:products[0].id,similarity:0.8}]))
    await expect(searchConsumerCatalogByVector(spec,products,local)).rejects.toMatchObject({code:'INDEX_STALE'})
    expect(m.embed).toHaveBeenCalledTimes(1)
  })
  it.each(['model','revision','preprocessing','indexVersion','dimensions'])('rejects a mismatched %s before any model request',async(field)=>{
    m.from.mockReturnValue(chain({profile:{...profile,[field]:'different'},status:'ready'}))
    await expect(searchConsumerCatalogByVector(spec,products,profile)).rejects.toMatchObject({code:'INDEX_PROFILE_MISMATCH',metrics:{embeddingCalls:0}})
    expect(m.embed).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled()
  })
  it('rejects incomplete or stale document vectors before spending tokens',async()=>{
    m.from.mockImplementation((table:string)=>chain(table==='consumer_embedding_profiles'?{profile,status:'ready'}:[]))
    await expect(searchConsumerCatalogByVector(spec,products,profile)).rejects.toMatchObject({code:'INDEX_INCOMPLETE'})
    expect(m.embed).not.toHaveBeenCalled()
  })
  it('rejects extra index profile fields before making an embedding request',async()=>{
    m.from.mockReturnValue(chain({profile:{...profile,revisionDigest:'different'},status:'ready'}))
    await expect(searchConsumerCatalogByVector(spec,products,profile)).rejects.toMatchObject({code:'INDEX_PROFILE_MISMATCH',metrics:{embeddingCalls:0}})
    expect(m.embed).not.toHaveBeenCalled()
  })
  it('reports a concurrent index change instead of silently returning an empty result',async()=>{
    m.rpc.mockReturnValue(chain([]))
    await expect(searchConsumerCatalogByVector(spec,products,profile)).rejects.toMatchObject({code:'INDEX_CHANGED',metrics:{embeddingCalls:1}})
  })
  it('builds the reviewed catalog in bounded Qwen batches with one profile lease, without deleting any vector',async()=>{
    m.from.mockReturnValue(chain([]))
    const result=await indexPendingConsumerProducts(profile.id)
    expect(result).toMatchObject({status:'ready',indexed:35,calls:4})
    expect(m.embed.mock.calls.map((call)=>call[1].length)).toEqual([10,10,10,5])
    expect(m.embed.mock.calls.every((call)=>call[0]===profile&&call[2]==='document')).toBe(true)
    const claim=m.rpc.mock.calls[0][1]
    for(const [name,input] of m.rpc.mock.calls.filter(([name])=>name==='write_consumer_catalog_vectors')) {
      expect(name).toBe('write_consumer_catalog_vectors');expect(input.p_token).toBe(claim.p_token);expect(input.p_profile).toBe(profile)
    }
  })
  it('does not build while a different worker owns the lease',async()=>{
    m.rpc.mockReturnValue(chain(false))
    expect(await indexPendingConsumerProducts(profile.id)).toMatchObject({status:'busy',calls:0})
    expect(m.embed).not.toHaveBeenCalled()
  })
  it('marks a failed build without removing existing vector data',async()=>{
    m.from.mockReturnValue(chain([]));m.embed.mockRejectedValue(new Error('provider offline'))
    await expect(indexPendingConsumerProducts(profile.id)).rejects.toThrow('provider offline')
    expect(m.rpc).toHaveBeenLastCalledWith('finish_consumer_embedding_profile',expect.objectContaining({p_profile_id:profile.id,p_error:'INDEX_BUILD_FAILED'}))
  })
})
