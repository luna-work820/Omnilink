import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const reads = vi.hoisted(() => ({ recent:vi.fn(),keyword:vi.fn(),semantic:vi.fn() }))
vi.mock('@/lib/storefront/service', () => ({getStorefrontDiscoveryItems:reads.recent,searchStorefrontDiscoveryItems:reads.keyword}))
vi.mock('./consumer-catalog-vector', () => ({searchConsumerCatalogByVector:reads.semantic}))
import { planConsumerTask, retrieveConsumerSearchCandidates, routeConsumerEntry, validateConsumerMemoryUpdate } from './consumer-entry-workflow'
import type { AiAssistantMemory } from './ai-assistant-memory'
const memory = (overrides:Partial<AiAssistantMemory> = {}):AiAssistantMemory => ({
  id:'memory',domain:'space',text:'喜欢阅读角的木质家具',origin:'user',status:'active',evidence:null,
  sourceMessageId:null,supportIds:[],supersedeIds:[],confirmedAt:'2026-11-11T00:00:00Z',revision:1,...overrides,
})
beforeEach(() => { vi.clearAllMocks(); reads.recent.mockResolvedValue([]); reads.keyword.mockResolvedValue([]); reads.semantic.mockResolvedValue([]) })
describe('existing Mastra workflows', () => {
  it.each([['你好','assistant'],['沙发','product-search'],['比较这两款','comparison']])('routes %s before execution',async (prompt,intent) => {
    expect(await routeConsumerEntry({prompt,hasImage:false,hasDocument:false,hasActiveSkill:false,hasSelectedProducts:false})).toEqual({intent})
  })
  it('keeps uploaded documents out of ordinary product search',async () => {
    expect(await routeConsumerEntry({prompt:'沙发',hasImage:false,hasDocument:true,hasActiveSkill:false,hasSelectedProducts:false})).toEqual({intent:'document-analysis'})
  })
  it('does not retrieve unneeded keyword/vector candidates',async () => {
    expect(await retrieveConsumerSearchCandidates({query:'你好',enabled:false,maxPrice:null})).toMatchObject({keywordProductIds:[],semanticProductIds:[]})
    expect(reads.keyword).not.toHaveBeenCalled(); expect(reads.semantic).not.toHaveBeenCalled()
  })
  it('merges keyword and semantic candidates without duplicate IDs',async () => {
    reads.keyword.mockResolvedValue([{product:{id:'a'}},{product:{id:'b'}}])
    reads.semantic.mockResolvedValue([{id:'b',similarity:0.9},{id:'c',similarity:0.8}])
    expect((await retrieveConsumerSearchCandidates({query:'沙发',enabled:true,maxPrice:1000})).rankedProductIds).toEqual(['b','a','c'])
  })
  it('accepts proposed memory in Zod but excludes it and unconfirmed legacy memory from plans',async () => {
    const result = await planConsumerTask({prompt:'推荐阅读角的木质家具',intent:'product-search',history:[],
      memories:[memory(),memory({id:'proposal',status:'proposed',confirmedAt:null}),memory({id:'legacy',confirmedAt:null})],
      catalog:[],selectedProductIds:[],previousProductIds:[],savedProductIds:[],rejectedProductIds:[]})
    expect(result.relevantMemoryIds).toEqual(['memory'])
  })
  it('deduplicates proposed candidates before persistence',async () => {
    expect(await validateConsumerMemoryUpdate({prompt:'我喜欢木质家具',memoryUpdate:{text:'木质家具',domain:'space',origin:'user',evidence:'喜欢木质家具'},
      memories:[memory({text:' 木质家具 ',status:'proposed',confirmedAt:null})]})).toBeNull()
  })
  it('does not let rejected history consume the live memory limit',async () => {
    const memories = Array.from({length:49},(_,i) => memory({id:`rejected-${i}`,status:'rejected'}))
    expect(await validateConsumerMemoryUpdate({prompt:'我喜欢木质家具',memoryUpdate:{text:'木质家具',domain:'space',origin:'user',evidence:'喜欢木质家具'},memories})).toMatchObject({text:'木质家具'})
  })
})
