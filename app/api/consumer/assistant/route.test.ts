import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const m = vi.hoisted(() => ({ getUser:vi.fn(),from:vi.fn(),generate:vi.fn(),load:vi.fn(),manage:vi.fn(),
  route:vi.fn(),ledger:vi.fn(),classify:vi.fn(),context:vi.fn(),discover:vi.fn(),search:vi.fn(),plan:vi.fn(),validate:vi.fn(),select:vi.fn(),byIds:vi.fn() }))
vi.mock('@/lib/consumer-advisor/execution-store',()=>({requestStore:m.ledger,requestFingerprint:()=> 'a'.repeat(64),searchInformation:vi.fn().mockResolvedValue([])}))
vi.mock('@/lib/consumer-advisor/comparison-workflow',()=>({createComparisonTask:vi.fn()}))
vi.mock('@/lib/consumer-advisor/intent-classifier',()=>({classifyConsumerIntent:m.classify}))
vi.mock('@/lib/consumer-advisor/personal-context',()=>({loadPersonalContext:m.context}))
vi.mock('@/lib/consumer-advisor/discovery-engine',()=>({startDiscovery:m.discover,discoveryActor:(_request:unknown,userId:string|null,sessionId:string)=>({userId,sessionId,guestHash:userId?null:'a'.repeat(64)}),attachDiscoveryActor:(response:Response)=>response}))
vi.mock('@/lib/supabase/server', () => ({createClientServer:async () => ({auth:{getUser:m.getUser},from:m.from})}))
vi.mock('@/lib/ai/workspace-generation', () => ({ generateWorkspaceText:m.generate,generateWorkspaceVisionText:m.generate,
  generateWorkspaceDeepSeekVisionText:m.generate,ModelConfigurationError:class extends Error {} }))
vi.mock('@/lib/consumer-advisor/deepseek-key-cookie', () => ({readDeepSeekKeyForUser:async () => null}))
vi.mock('@/lib/consumer-advisor/ai-assistant-memory', async (original) => ({...await original<typeof import('@/lib/consumer-advisor/ai-assistant-memory')>(),loadAiAssistantMemories:m.load,manageAiAssistantMemory:m.manage}))
vi.mock('@/lib/consumer-advisor/consumer-entry-workflow', () => ({routeConsumerEntry:m.route,retrieveConsumerSearchCandidates:m.search,
  planConsumerTask:m.plan,validateConsumerMemoryUpdate:m.validate,selectRelevantConsumerMemoryIds:m.select}))
vi.mock('@/lib/storefront/service', () => ({getStorefrontDiscoveryItemsByIds:m.byIds}))
import { POST } from './route'
const userId = '10000000-0000-4000-8000-000000000001'
const conversationId = '20000000-0000-4000-8000-000000000001'
const request = (body:unknown) => new NextRequest('http://localhost/api/consumer/assistant',{
  method:'POST',headers:{'content-type':'application/json','x-forwarded-for':crypto.randomUUID()},body:JSON.stringify(body),
})
function query(data:unknown[] = []) {
  const result = {data,error:null}
  const chain = {select:vi.fn(),eq:vi.fn(),order:vi.fn(),limit:vi.fn(),upsert:vi.fn().mockResolvedValue(result),insert:vi.fn().mockResolvedValue(result)}
  for (const key of ['select','eq','order'] as const) chain[key].mockReturnValue(chain)
  chain.limit.mockResolvedValue(result)
  return chain
}
beforeEach(() => {
  vi.clearAllMocks()
  m.getUser.mockResolvedValue({data:{user:null},error:null})
  m.from.mockImplementation(() => query())
  m.generate.mockResolvedValue(JSON.stringify({analysisText:'测试回复',matchedProductIds:[],usedMemoryIds:[]}))
  m.load.mockResolvedValue([]); m.manage.mockResolvedValue({status:'proposed'})
  m.route.mockResolvedValue({intent:'assistant'})
  m.classify.mockResolvedValue({intent:'assistant',search:null,needsPersonalContext:false})
  m.ledger.mockResolvedValue({created:true,status:'running',token:crypto.randomUUID()})
  m.context.mockResolvedValue({userId,version:1,memories:[]})
  m.search.mockResolvedValue({recentProductIds:[],keywordProductIds:[],semanticProductIds:[],rankedProductIds:[]})
  m.byIds.mockResolvedValue([]); m.select.mockReturnValue([]); m.validate.mockResolvedValue(null)
  m.plan.mockResolvedValue({intent:'assistant',relevantMemoryIds:[],comparisonProductIds:[],memoryCaptureRequested:false,searchResult:null})
})
describe('assistant API security boundary', () => {
  it.each([{name:'AuthApiError',status:503},{name:'AuthApiError',status:429}])('stops before routing, model calls and user data reads when auth fails', async (error) => {
    m.getUser.mockResolvedValue({data:{user:null},error})
    const response = await POST(request({model:'qwen-plus',prompt:'你好'}))
    expect(response.status).toBe(503)
    expect(m.generate).not.toHaveBeenCalled(); expect(m.route).not.toHaveBeenCalled(); expect(m.from).not.toHaveBeenCalled()
  })
  it('returns authoritative identifiers and keeps ordinary chat free of memory writes',async () => {
    const response = await POST(request({model:'qwen-plus',prompt:'你好',conversationId,messageId:'test-message'}))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({requestId:'test-message',sessionId:conversationId,conversationId,contractVersion:1,text:'测试回复',memorySaved:false})
    expect(m.manage).not.toHaveBeenCalled();expect(m.context).not.toHaveBeenCalled();expect(m.search).not.toHaveBeenCalled()
  })
  it.each([null,[],{model:'qwen-plus',prompt:'你好',conversationId:'broken'}])('rejects invalid transport without calling a model',async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(m.generate).not.toHaveBeenCalled()
  })
  it('does not turn questionnaire or editable metadata into trusted recommendation context',async () => {
    m.getUser.mockResolvedValue({data:{user:{id:userId,user_metadata:{ai_assistant_profile:{
      name:'Test',preferences:{clothing:'UNCONFIRMED_STYLE',other:'UNCONFIRMED_OTHER'},
      shoppingPreferenceSurvey:{version:'1.1.0',status:'complete',answers:{E1:['UNCONFIRMED_STYLE']},skipped:[],ladders:{}}
    }}}},error:null})
    const response = await POST(request({model:'qwen-plus',prompt:'你好',conversationId,messageId:'metadata-message'}))
    expect(response.status).toBe(200)
    const prompt = String(m.generate.mock.calls[0][1])
    expect(prompt).not.toContain('UNCONFIRMED_STYLE'); expect(prompt).not.toContain('UNCONFIRMED_OTHER')
  })
  it('creates a proposal and leaves replacement effects to the confirmation transaction',async () => {
    m.getUser.mockResolvedValue({data:{user:{id:userId,user_metadata:{}}},error:null})
    m.validate.mockResolvedValue({text:'偏好木质家具',domain:'space',origin:'user',evidence:'我喜欢木质家具',supports:[],supersedeIds:['old-id']})
    const response = await POST(request({model:'qwen-plus',prompt:'我喜欢木质家具',conversationId,messageId:'proposal-message'}))
    expect(response.status).toBe(200)
    expect(m.manage).toHaveBeenCalledWith(userId,'propose',expect.objectContaining({sourceKind:'chat',origin:'user',supersedeIds:['old-id']}))
    expect(await response.json()).toMatchObject({memorySaved:false,memoryProposed:true})
  })
  it('uses the newest assistant turn without reversing the source history',async () => {
    m.getUser.mockResolvedValue({data:{user:{id:userId,user_metadata:{}}},error:null})
    const history = [{role:'user',content:'本轮'}, {role:'assistant',content:'最新',style_tag:'商品对比',matched_product_ids:[]},
      {role:'assistant',content:'更早',style_tag:'商品检索',matched_product_ids:[]}]
    m.from.mockImplementation(() => query(history))
    await POST(request({model:'qwen-plus',prompt:'继续',conversationId,messageId:'history-message'}))
    expect(m.classify).toHaveBeenCalledWith(expect.objectContaining({history:expect.arrayContaining([expect.objectContaining({content:'助手：最新'})])}))
    expect(history[0].content).toBe('本轮')
  })
  it('returns the first product page after classification without a final-answer model call or legacy search',async()=>{
    const spec={query:'沙发',termGroups:[['沙发']],excludedTerms:[],minPrice:null,maxPrice:null,currency:'CNY',type:'商品',sessionTerms:[],questionDismissed:false}
    const page={searchRunId:crypto.randomUUID(),sessionId:conversationId,query:'沙发',products:[],nextCursor:null,contextVersion:0,
      snapshotVersion:1,pageSize:20,returnedCount:0,candidateCount:0,question:null,spec}
    m.classify.mockResolvedValue({intent:'product-search',search:spec})
    m.discover.mockResolvedValue(page)
    const response=await POST(request({model:'qwen-plus',prompt:'沙发',conversationId}))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({status:'completed',discovery:page,model:null,source:'discovery-engine'})
    expect(m.classify).toHaveBeenCalledTimes(1)
    expect(m.generate).not.toHaveBeenCalled();expect(m.search).not.toHaveBeenCalled();expect(m.plan).not.toHaveBeenCalled()
  })
  it('returns a catalog failure with a reusable specification instead of a fabricated empty page',async()=>{
    const {DiscoveryError}=await import('@/lib/consumer-advisor/discovery-contract')
    const spec={query:'沙发',termGroups:[['沙发']]}
    m.classify.mockResolvedValue({intent:'product-search',search:spec})
    m.discover.mockRejectedValue(new DiscoveryError('CATALOG_UNAVAILABLE',503,'商品暂时无法读取，请重试。'))
    const response=await POST(request({model:'qwen-plus',prompt:'沙发',conversationId}))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({status:'failed',code:'CATALOG_UNAVAILABLE',retrySpec:spec,blocks:[]})
    expect(m.generate).not.toHaveBeenCalled()
  })
  it('replays a finished request without another model call',async()=>{
    m.ledger.mockResolvedValueOnce({created:false,status:'completed',http_status:200,result:{requestId:'replay',sessionId:conversationId,
      conversationId,contractVersion:1,status:'completed',text:'已保存回复',blocks:[],metrics:{modelCalls:2}}})
    const response=await POST(request({model:'qwen-plus',prompt:'你好',conversationId,messageId:'replay'}))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({text:'已保存回复',replayed:true,metrics:{modelCalls:0,originalModelCalls:2}})
    expect(m.classify).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled()
  })
  it('does not repeat a request whose provider outcome is still unknown',async()=>{
    m.ledger.mockResolvedValueOnce({created:false,status:'running'})
    expect((await POST(request({model:'qwen-plus',prompt:'你好',conversationId,messageId:'running'}))).status).toBe(409)
    expect(m.classify).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled()
  })
  it('resolves guest product references only through the published projection',async()=>{
    const id=crypto.randomUUID()
    m.classify.mockResolvedValue({intent:'product-question',search:null,needsPersonalContext:false,needsSourceContext:false})
    const response=await POST(request({model:'qwen-plus',prompt:'这件的材质是什么',conversationId,previousProductIds:[id,'invalid']}))
    expect(response.status).toBe(200);expect(m.byIds).toHaveBeenCalledWith([id])
  })
  it('uses server history for authenticated product references',async()=>{
    m.getUser.mockResolvedValue({data:{user:{id:userId,user_metadata:{}}},error:null})
    m.classify.mockResolvedValue({intent:'product-question',search:null,needsPersonalContext:false,needsSourceContext:false})
    expect((await POST(request({model:'qwen-plus',prompt:'这件的材质是什么',conversationId,previousProductIds:[crypto.randomUUID()]}))).status).toBe(200)
    expect(m.byIds).not.toHaveBeenCalled()
  })
})
