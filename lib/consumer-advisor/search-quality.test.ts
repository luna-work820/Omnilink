import {describe,expect,it,vi,afterEach} from 'vitest'
vi.mock('server-only',()=>({}))
import {readConsumerCatalog} from '@/lib/products/consumer-catalog'
import {discoverySpecSchema} from './discovery-contract'
import {embeddingProfiles} from './embedding-profile'
import {productEmbeddingDocument} from './consumer-catalog-vector'
import {matchesSearchConcept,spreadStores,eligibleConsumerProduct} from './search-spec'
import {consumerModelPolicy} from './model-policy'
import {executionMetrics,measureConsumerModel} from './execution-metrics'
import {packContextItems,clipContextText} from './context-budget'
const base=readConsumerCatalog()[0]
afterEach(()=>vi.unstubAllEnvs())
describe('fact text, diversity and task configuration',()=>{
  it('keeps v1 byte-stable while v2 excludes policy noise and adds only evidenced aliases',()=>{
    const v1=productEmbeddingDocument(base,embeddingProfiles['bge-small-zh-v1.5-512-v1'])
    const v2=productEmbeddingDocument(base,embeddingProfiles['bge-small-zh-v1.5-512-v2'])
    expect(v1.text).toContain('配送')
    expect(v2.text).not.toMatch(/配送|未核验|价格状态|库存状态|https:/)
    expect(v2.text).toContain('recycled glass')
    expect(v2.hash).not.toBe(v1.hash)
    expect(v2.text).not.toContain('solid gold')
  })
  it('does not equate gold plating with solid gold or ordinary silver with recycled silver',()=>{
    expect(matchesSearchConcept('gold-plated brass','镀金')).toBe(true)
    expect(matchesSearchConcept('gold-plated brass','solid gold')).toBe(false)
    expect(matchesSearchConcept('925 sterling silver','再生银')).toBe(false)
    const spec=discoverySpecSchema.parse({query:'回收玻璃项链',termGroups:[['necklace'],['recycled glass']]})
    expect(eligibleConsumerProduct(base,spec)).toBe(true)
  })
  it('spreads only a nearby relevance group and keeps the highest-relevance first result',()=>{
    const products=[...Array.from({length:3},(_,i)=>({...base,id:'a'+i,storeName:'A',storeSlug:'a'})),
      {...base,id:'b',storeName:'B',storeSlug:'b'},{...base,id:'low',storeName:'C',storeSlug:'c'}]
    const result=spreadStores(products,(p)=>p.id==='low'?0:4)
    expect(result.map((p)=>p.id)).toEqual(['a0','b','a1','a2','low'])
    expect(new Set(result.map((p)=>p.id)).size).toBe(products.length)
  })
  it('keeps parsing independent of every answer dropdown option',()=>{
    vi.stubEnv('CONSUMER_PARSER_MODEL','')
    for(const answer of ['qwen-plus','gemini','deepseek-flash','deepseek-v4-pro'] as const)expect(consumerModelPolicy(answer)).toMatchObject({parser:'qwen-plus',answer})
    vi.stubEnv('CONSUMER_PARSER_MODEL','deepseek-flash')
    expect(consumerModelPolicy('gemini').parser).toBe('deepseek-flash')
    vi.stubEnv('CONSUMER_PARSER_MODEL','unsupported')
    expect(()=>consumerModelPolicy('gemini')).toThrow()
  })
  it('packs whole records, preserves valid Unicode, and reports omission without fabricating usage',()=>{
    const result=packContextItems([{text:'x'.repeat(100)},{text:'ok'}],30)
    expect(result.items).toEqual([{text:'ok'}]);expect(result.budget.omitted).toBe(1)
    expect(clipContextText('中文abc',7).text).toBe('中文a')
  })
  it('sums parse and answer usage and keeps unknown usage and cost explicit',async()=>{
    const stages:Parameters<typeof measureConsumerModel>[0]=[]
    await measureConsumerModel(stages,'parse','qwen-plus',async({onUsage,onCall})=>{onCall!();onUsage!({inputTokens:10,outputTokens:2,cachedInputTokens:0});return 'parsed'})
    await measureConsumerModel(stages,'answer','gemini',async({onUsage,onCall})=>{onCall!();onUsage!({inputTokens:20,outputTokens:8,cachedInputTokens:null});return 'answer'})
    expect(executionMetrics(stages,{},performance.now())).toMatchObject({usage:{inputTokens:30,outputTokens:10,cachedInputTokens:null},usageScope:'request',cost:null})
    await measureConsumerModel(stages,'answer','gemini',async({onCall})=>{onCall!();return 'no usage supplied'})
    expect(executionMetrics(stages,{},performance.now()).usage.inputTokens).toBeNull()
  })
})
