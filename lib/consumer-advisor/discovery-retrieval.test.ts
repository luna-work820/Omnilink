import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only',()=>({}))
vi.mock('./consumer-catalog-vector',async(original)=>({...await original<typeof import('./consumer-catalog-vector')>(),searchConsumerCatalogByVector:vi.fn()}))
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
import { discoverySpecSchema } from './discovery-contract'
import { embeddingProfiles } from './embedding-profile'
import { SemanticSearchError } from './consumer-catalog-vector'
import { retrieveDiscoveryCandidates } from './discovery-retrieval'
import { keywordSearchSpec, simpleProductSearchSpec, eligibleConsumerProduct } from './search-spec'
import { pageCatalogExecution } from './discovery-engine'
import { catalogSnapshot } from '@/lib/products/consumer-catalog-store'

const base=readConsumerCatalog()[0]
const metrics={embeddingCalls:1,embeddingInputTokens:8,embeddingMs:2,retrievalMs:3}
const profile=embeddingProfiles['qwen-text-embedding-v4-1024-v1']
const make=(patch={})=>discoverySpecSchema.parse({query:'耳环',termGroups:[['耳环','earrings']],...patch})
afterEach(()=>vi.unstubAllEnvs())
describe('one search specification across retrieval and paging',()=>{
  it.each(['keyword','semantic','hybrid'] as const)('enforces currency, unknown prices, exclusions and required terms in %s',async(mode)=>{
    const products=[
      {...base,id:'eligible',name:'Silver earrings',shortDescription:'银色 耳环',specs:{},price:80,priceMode:'amount' as const,currency:'USD'},
      {...base,id:'unknown',name:'Silver earrings',specs:{},price:0,priceMode:'unknown' as const,currency:'USD'},
      {...base,id:'wrong-currency',name:'Silver earrings',specs:{},price:80,priceMode:'amount' as const,currency:'CNY'},
      {...base,id:'excluded',name:'Nickel earrings',specs:{},price:80,priceMode:'amount' as const,currency:'USD'},
      {...base,id:'expensive',name:'Silver earrings',specs:{},price:200,priceMode:'amount' as const,currency:'USD'},
    ]
    const spec=make({maxPrice:100,currency:'USD',excludedTerms:['nickel'],retrieval:{mode,profile:profile.id}})
    const semantic=vi.fn().mockResolvedValue({matches:[{id:'excluded',similarity:1},{id:'eligible',similarity:0.8}],metrics})
    const result=await retrieveDiscoveryCandidates(spec,undefined,undefined,{catalog:()=>products,semantic})
    expect(result.products.map((p)=>p.id)).toEqual(['eligible'])
    if(mode==='keyword')expect(semantic).not.toHaveBeenCalled()
    else expect(semantic.mock.calls[0][1].map((p:{id:string})=>p.id)).toEqual(['eligible'])
  })
  it('keeps a free item distinct from a stale zero or unknown price',()=>{
    const spec=make({termGroups:[],maxPrice:0})
    expect(eligibleConsumerProduct({...base,price:0,priceMode:'unknown'},spec)).toBe(false)
    expect(eligibleConsumerProduct({...base,price:0,priceMode:'free'},spec)).toBe(true)
    expect(eligibleConsumerProduct({...base,price:100,priceMode:'inquiry'},make({termGroups:[]}))).toBe(true)
  })
  it('never treats an unverified shipping note as delivery eligibility',async()=>{
    const spec=make({query:'必须能配送中国大陆的耳环',deliveryCountry:'CN',requireVerifiedDelivery:true})
    expect((await retrieveDiscoveryCandidates(spec)).products).toHaveLength(0)
    expect(eligibleConsumerProduct({...base,catalogEvidence:{...base.catalogEvidence!,verifiedDeliveryCountries:['CN']}},{...spec,termGroups:[]})).toBe(true)
    expect((await retrieveDiscoveryCandidates(make({termGroups:[['中国大陆']]}))).products).toHaveLength(0)
  })
  it('keeps reviewed numeric prices searchable while excluding the five unconfirmed prices',async()=>{
    const rates={date:'2026-11-19',rates:{EUR:1,USD:1,CNY:7}}
    const result=await retrieveDiscoveryCandidates(make({query:'USD items',termGroups:[],maxPrice:300,currency:'USD',retrieval:{mode:'keyword'}}),undefined,undefined,
      {catalog:readConsumerCatalog,semantic:vi.fn(),rates:async()=>rates})
    expect(result.products.length).toBeGreaterThan(0)
    expect(result.products.every((product)=>product.priceMode==='amount'&&
      (product.currency==='USD'||product.currency==='EUR'?product.price:product.currency==='CNY'?product.price/7:Infinity)<=300)).toBe(true)
    expect(readConsumerCatalog().filter((product)=>product.priceMode==='unknown')).toHaveLength(5)
  })
  it.each(['INDEX_PROFILE_MISMATCH','INDEX_STALE','INDEX_NOT_READY','EMBEDDING_UNAVAILABLE'])('returns explicit keyword degradation on %s',async(reason)=>{
    const semantic=vi.fn().mockRejectedValue(new SemanticSearchError(reason,{...metrics,embeddingCalls:reason.startsWith('INDEX')?0:1}))
    const spec=make({termGroups:[],retrieval:{mode:'semantic',profile:profile.id}})
    const result=await retrieveDiscoveryCandidates(spec,undefined,undefined,{catalog:()=>[base],semantic})
    expect(result.products).toEqual([base])
    expect(result.report).toMatchObject({effectiveMode:'keyword',degraded:true,reason,profile,embeddingCalls:reason.startsWith('INDEX')?0:1})
  })
  it('offers a keyword rollback without touching the vector provider',async()=>{
    vi.stubEnv('CONSUMER_RETRIEVAL_MODE','keyword')
    const semantic=vi.fn()
    const result=await retrieveDiscoveryCandidates(make({termGroups:[],retrieval:{mode:'hybrid',profile:profile.id}}),undefined,undefined,{catalog:()=>[base],semantic})
    expect(result.report).toMatchObject({effectiveMode:'keyword',reason:'KEYWORD_OVERRIDE',embeddingCalls:0})
    expect(semantic).not.toHaveBeenCalled()
  })
  it('uses the same injected catalog for default hybrid retrieval and excludes unknown vector IDs',async()=>{
    const other={...base,id:'external-new',name:'Pearl earrings'}
    const semantic=vi.fn().mockResolvedValue({matches:[{id:'external-new',similarity:0.9},{id:'external-outside',similarity:1}],metrics})
    const result=await retrieveDiscoveryCandidates(make({termGroups:[]}),undefined,undefined,{catalog:()=>[base,other],semantic})
    expect(result.report).toMatchObject({effectiveMode:'hybrid',degraded:false})
    expect(semantic.mock.calls[0][1].map((p:{id:string})=>p.id)).toEqual([base.id,other.id].sort())
    expect(result.products.map((p)=>p.id)).toContain('external-new')
    expect(result.products.map((p)=>p.id)).not.toContain('external-outside')
  })
  it('reuses a catalog snapshot already read by the caller',async()=>{
    const snapshot=catalogSnapshot([base])
    const catalog=vi.fn().mockRejectedValue(new Error('must not reread catalog'))
    const result=await retrieveDiscoveryCandidates(make({termGroups:[],retrieval:{mode:'keyword'}}),undefined,undefined,
      {catalog,semantic:vi.fn()},undefined,snapshot)
    expect(catalog).not.toHaveBeenCalled()
    expect(result.catalogVersion).toBe(snapshot.version)
    expect(result.products).toEqual(snapshot.products)
  })
  it('lets semantic recall include related wording while retaining category, required terms and exclusions',async()=>{
    const products=[
      {...base,id:'exact',name:'Black vintage dress',category:'dress',shortDescription:'cotton',specs:{}},
      {...base,id:'related',name:'Black retro dress',category:'dress',shortDescription:'cotton',specs:{}},
      {...base,id:'wrong-color',name:'White retro dress',category:'dress',shortDescription:'cotton',specs:{}},
      {...base,id:'wrong-category',name:'Black retro necklace',category:'necklace',shortDescription:'cotton',specs:{}},
      {...base,id:'excluded',name:'Black retro dress with silk',category:'dress',shortDescription:'cotton',specs:{}},
    ]
    const spec=make({query:'只要黑色复古连衣裙，不要丝绸',termGroups:[['连衣裙','dress'],['复古','vintage']],
      requiredTermGroups:[['黑色','black']],excludedTerms:['silk'],retrieval:{mode:'hybrid'}})
    const semantic=vi.fn().mockResolvedValue({matches:[{id:'related',similarity:0.9},{id:'exact',similarity:0.8}],metrics})
    const result=await retrieveDiscoveryCandidates(spec,undefined,undefined,{catalog:()=>products,semantic})
    expect(semantic.mock.calls[0][1].map((p:{id:string})=>p.id).sort()).toEqual(['exact','related'])
    expect(result.keywordIds).toEqual(['exact'])
    expect(result.products.map((p)=>p.id)).toEqual(expect.arrayContaining(['exact','related']))
    const page=pageCatalogExecution(spec,{catalogVersion:result.catalogVersion,candidateKeys:result.products.map((p)=>p.id),retrieval:result.report},0,products,result.catalogVersion)
    expect(page.products.map((p)=>p.id)).toEqual(expect.arrayContaining(['exact','related']))
  })
  it('includes dresses and skirts for the broad single keyword 裙子, but not trousers',async()=>{
    const products=[{...base,id:'dress',name:'Black dress',category:'连衣裙',shortDescription:'',specs:{}},
      {...base,id:'skirt',name:'Black skirt',category:'半身裙',shortDescription:'',specs:{}},
      {...base,id:'pants',name:'Black trousers',category:'裤装',shortDescription:'',specs:{}}]
    const semantic=vi.fn().mockResolvedValue({matches:[{id:'dress',similarity:0.9},{id:'skirt',similarity:0.8}],metrics})
    const result=await retrieveDiscoveryCandidates(simpleProductSearchSpec('裙子')!,undefined,undefined,{catalog:()=>products,semantic})
    expect(result.products.map((p)=>p.id).sort()).toEqual(['dress','skirt'])
    expect(result.keywordIds.sort()).toEqual(['dress','skirt'])
    expect(semantic.mock.calls[0][1].map((p:{id:string})=>p.id).sort()).toEqual(['dress','skirt'])
  })
  it('keeps the product category while using style as a soft recall signal',async()=>{
    const products=[{...base,id:'vintage-dress',name:'Vintage dress',category:'连衣裙',specs:{}},
      {...base,id:'vintage-sweater',name:'Vintage sweater',category:'毛衣',specs:{}},
      {...base,id:'plain-shirt',name:'Cotton shirt',category:'上衣',specs:{}},
      {...base,id:'vintage-necklace',name:'Vintage necklace',category:'项链',specs:{}}]
    const spec=simpleProductSearchSpec('复古衣服')!
    const semantic=vi.fn().mockResolvedValue({matches:[{id:'vintage-necklace',similarity:1},{id:'vintage-dress',similarity:0.9},{id:'vintage-sweater',similarity:0.85},{id:'plain-shirt',similarity:0.8}],metrics})
    const result=await retrieveDiscoveryCandidates(spec,undefined,undefined,{catalog:()=>products,semantic})
    expect(semantic.mock.calls[0][1].map((p:{id:string})=>p.id).sort()).toEqual(['plain-shirt','vintage-dress','vintage-sweater'])
    expect(result.products.map((product)=>product.id)).toEqual(['vintage-dress','vintage-sweater','plain-shirt'])
  })
  it('does not treat a dress that mentions a skirt in its description as a skirt',async()=>{
    const products=[{...base,id:'dress',name:'Black dress',category:'连衣裙',shortDescription:'a gathered skirt',specs:{}},
      {...base,id:'skirt',name:'Black skirt',category:'半身裙',shortDescription:'',specs:{}}]
    const semantic=vi.fn().mockResolvedValue({matches:[{id:'dress',similarity:1},{id:'skirt',similarity:0.8}],metrics})
    const result=await retrieveDiscoveryCandidates(simpleProductSearchSpec('半身裙')!,undefined,undefined,{catalog:()=>products,semantic})
    expect(result.products.map((p)=>p.id)).toEqual(['skirt'])
    expect(semantic.mock.calls[0][1].map((p:{id:string})=>p.id)).toEqual(['skirt'])
  })
  it('keeps a category discovered in the catalog as a hard condition',async()=>{
    const products=[{...base,id:'shoe',name:'Canvas slip on',category:'帆布鞋',specs:{}},
      {...base,id:'shirt',name:'Cotton shirt',category:'上衣',shortDescription:'适合搭配帆布鞋',specs:{}}]
    const semantic=vi.fn().mockResolvedValue({matches:[{id:'shoe',similarity:0.9},{id:'shirt',similarity:0.8}],metrics})
    const result=await retrieveDiscoveryCandidates(simpleProductSearchSpec('帆布鞋','商品',products)!,undefined,undefined,{catalog:()=>products,semantic})
    expect(result.products.map((p)=>p.id)).toEqual(['shoe'])
    expect(semantic.mock.calls[0][1].map((p:{id:string})=>p.id)).toEqual(['shoe'])
  })
  it('uses one exchange snapshot for filtering and every page, and rejects missing rates',async()=>{
    const products=[
      {...base,id:'usd-ok',name:'Dress',category:'dress',specs:{},price:10,priceMode:'amount' as const,currency:'USD'},
      {...base,id:'usd-over',name:'Dress',category:'dress',specs:{},price:20,priceMode:'amount' as const,currency:'USD'},
      {...base,id:'cny',name:'Dress',category:'dress',specs:{},price:60,priceMode:'amount' as const,currency:'CNY'},
      {...base,id:'unrated',name:'Dress',category:'dress',specs:{},price:1,priceMode:'amount' as const,currency:'XYZ'},
    ]
    const rates={date:'2026-11-19',rates:{EUR:1,USD:1,CNY:7}}
    const spec=make({query:'100元以内的连衣裙',termGroups:[['dress']],currency:'CNY',maxPrice:100,retrieval:{mode:'keyword'}})
    const result=await retrieveDiscoveryCandidates(spec,undefined,undefined,{catalog:()=>products,semantic:vi.fn(),rates:async()=>rates})
    expect(result.products.map((p)=>p.id).sort()).toEqual(['cny','usd-ok'])
    expect(result.priceReference).toEqual(rates)
    expect(result.priceWarning).toBe(true)
    const page=pageCatalogExecution(spec,{catalogVersion:result.catalogVersion,candidateKeys:result.products.map((p)=>p.id),retrieval:result.report,priceReference:rates},0,products,result.catalogVersion)
    expect(page.products.map((p)=>p.id).sort()).toEqual(['cny','usd-ok'])
    const unavailable=await retrieveDiscoveryCandidates(spec,undefined,undefined,{catalog:()=>products,semantic:vi.fn(),rates:async()=>null})
    expect(unavailable.products.map((p)=>p.id)).toEqual(['cny'])
    expect(unavailable.priceWarning).toBe(true)
    const nextRates=vi.fn().mockResolvedValue({date:'2026-11-20',rates:{USD:1,CNY:20}})
    const refined=await retrieveDiscoveryCandidates({...spec,maxPrice:90},undefined,undefined,{catalog:()=>products,semantic:vi.fn(),rates:nextRates},rates)
    expect(nextRates).not.toHaveBeenCalled()
    expect(refined.priceReference).toEqual(rates)
    expect(refined.products.map((p)=>p.id).sort()).toEqual(['cny','usd-ok'])
  })
  it('does not turn cancellation into a successful keyword fallback',async()=>{
    const controller=new AbortController();controller.abort()
    await expect(retrieveDiscoveryCandidates(make(),undefined,controller.signal)).rejects.toMatchObject({name:'AbortError'})
  })
  it.each([['耳环','earrings'],['项链','necklace'],['戒指','rings']])('compares Chinese %s and English %s against the same reviewed catalog',async(zh,en)=>{
    const a=await retrieveDiscoveryCandidates(keywordSearchSpec(zh)),b=await retrieveDiscoveryCandidates(keywordSearchSpec(en))
    expect(a.products.length).toBeGreaterThan(0)
    expect(a.products.map((p)=>p.id)).toEqual(b.products.map((p)=>p.id))
    expect(a.report.embeddingCalls+b.report.embeddingCalls).toBe(0)
  })
  it('does not treat earrings as rings or provenance URLs as product attributes',async()=>{
    const rings=await retrieveDiscoveryCandidates(keywordSearchSpec('戒指'))
    expect(rings.products.length).toBeGreaterThan(0)
    expect(rings.products.every((product)=>!/earring/i.test(product.name))).toBe(true)
    const earrings=await retrieveDiscoveryCandidates(keywordSearchSpec('耳环'))
    expect(earrings.products.some((product)=>product.name==='Tiny Zodiac Medallion Necklace')).toBe(false)
  })
  it('pages 35 approved products as 20 + 15 with no repeated IDs and rechecks changed hard conditions',async()=>{
    const spec=make({query:'全部商品',termGroups:[]}),result=await retrieveDiscoveryCandidates(spec)
    const execution={catalogVersion:'five-store-v1',candidateKeys:result.products.map((p)=>p.id),retrieval:result.report}
    const catalog=readConsumerCatalog()
    const first=pageCatalogExecution(spec,execution,0,catalog,'five-store-v1'),second=pageCatalogExecution(spec,execution,first.nextOffset!,catalog,'five-store-v1')
    expect(first.products).toHaveLength(20);expect(second.products).toHaveLength(15);expect(second.nextOffset).toBeNull()
    expect(new Set([...first.products,...second.products].map((p)=>p.id)).size).toBe(35)
    const filtered=pageCatalogExecution({...spec,maxPrice:0},execution,0,catalog,'five-store-v1')
    expect(filtered.products).toHaveLength(0)
    expect(execution.candidateKeys).toHaveLength(35)
    expect(()=>pageCatalogExecution(spec,execution,0,catalog,'updated-catalog')).toThrow('目录已更新')
  })
})
