import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const background = vi.hoisted(() => ({ after: vi.fn(), consolidate: vi.fn() }))
vi.mock('next/server', async (original) => ({ ...await original<typeof import('next/server')>(), after: background.after }))
vi.mock('@/lib/consumer-advisor/memory-consolidation', () => ({ consolidateRecentMemories: background.consolidate }))
const m = vi.hoisted(() => ({ getUser:vi.fn(),from:vi.fn(),generate:vi.fn(),load:vi.fn(),manage:vi.fn(),
  route:vi.fn(),ledger:vi.fn(),classify:vi.fn(),context:vi.fn(),discover:vi.fn(),owned:vi.fn(),search:vi.fn(),plan:vi.fn(),validate:vi.fn(),select:vi.fn(),byIds:vi.fn(),catalog:vi.fn() }))
vi.mock('@/lib/products/consumer-catalog-store',async(original)=>({...await original<typeof import('@/lib/products/consumer-catalog-store')>(),readPublishedConsumerCatalog:m.catalog}))
vi.mock('@/lib/consumer-advisor/execution-store',()=>({requestStore:m.ledger,requestFingerprint:()=> 'a'.repeat(64),searchInformation:vi.fn().mockResolvedValue([])}))
vi.mock('@/lib/consumer-advisor/comparison-workflow',()=>({createComparisonTask:vi.fn()}))
vi.mock('@/lib/consumer-advisor/intent-classifier',()=>({classifyConsumerIntent:m.classify}))
vi.mock('@/lib/consumer-advisor/personal-context',()=>({loadPersonalContext:m.context}))
vi.mock('@/lib/consumer-advisor/discovery-engine',()=>({startDiscovery:m.discover,ownedDiscoveryRun:m.owned,discoveryActor:(_request:unknown,userId:string|null,sessionId:string)=>({userId,sessionId,guestHash:userId?null:'a'.repeat(64)}),attachDiscoveryActor:(response:Response)=>response}))
vi.mock('@/lib/supabase/server', () => ({createClientServer:async () => ({auth:{getUser:m.getUser},from:m.from})}))
vi.mock('@/lib/ai/workspace-generation', () => ({ generateWorkspaceText:m.generate,generateWorkspaceVisionText:m.generate,
  generateWorkspaceDeepSeekVisionText:m.generate,ModelConfigurationError:class extends Error {} }))
vi.mock('@/lib/consumer-advisor/deepseek-key-cookie', () => ({readDeepSeekKeyForUser:async () => null}))
vi.mock('@/lib/consumer-advisor/ai-assistant-memory', async (original) => ({...await original<typeof import('@/lib/consumer-advisor/ai-assistant-memory')>(),loadAiAssistantMemories:m.load,manageAiAssistantMemory:m.manage}))
vi.mock('@/lib/consumer-advisor/consumer-entry-workflow', () => ({routeConsumerEntry:m.route,retrieveConsumerSearchCandidates:m.search,
  planConsumerTask:m.plan,validateConsumerMemoryUpdate:m.validate,selectRelevantConsumerMemoryIds:m.select}))
vi.mock('@/lib/storefront/service', () => ({getStorefrontDiscoveryItemsByIds:m.byIds}))
import { POST } from './route'
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
import { catalogSnapshot } from '@/lib/products/consumer-catalog-store'
import { keywordSearchSpec } from '@/lib/consumer-advisor/search-spec'
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
  m.generate.mockImplementation(async(_model,_prompt,_system,options)=>{options?.onCall?.();return JSON.stringify({analysisText:'测试回复',matchedProductIds:[],usedMemoryIds:[]})})
  m.load.mockResolvedValue([]); m.manage.mockResolvedValue({status:'proposed'})
  m.route.mockResolvedValue({intent:'assistant'})
  m.classify.mockResolvedValue({intent:'assistant',search:null,needsPersonalContext:false})
  m.ledger.mockResolvedValue({created:true,status:'running',token:crypto.randomUUID()})
  m.catalog.mockReset().mockResolvedValue(catalogSnapshot(readConsumerCatalog()))
  m.context.mockResolvedValue({userId,version:1,memories:[]})
  m.search.mockResolvedValue({recentProductIds:[],keywordProductIds:[],semanticProductIds:[],rankedProductIds:[]})
  m.byIds.mockResolvedValue([]); m.select.mockReturnValue([]); m.validate.mockResolvedValue(null)
  m.plan.mockResolvedValue({intent:'assistant',relevantMemoryIds:[],comparisonProductIds:[],memoryCaptureRequested:false,searchResult:null})
})
describe('assistant API security boundary', () => {
  it('starts the public catalog read while the request record is being created',async()=>{
    let release:(value:unknown)=>void=()=>{}
    m.ledger.mockImplementationOnce(()=>new Promise((resolve)=>{release=resolve}))
    const pending=POST(request({model:'qwen-plus',prompt:'你好',conversationId}))
    await vi.waitFor(()=>expect(m.ledger).toHaveBeenCalledTimes(1))
    const catalogStarted=m.catalog.mock.calls.length
    release({created:true,status:'running',token:crypto.randomUUID()})
    expect((await pending).status).toBe(200)
    expect(catalogStarted).toBe(1)
  })
  it('returns a request conflict even if the independent catalog read fails',async()=>{
    m.ledger.mockResolvedValueOnce({created:false,status:'running'})
    m.catalog.mockRejectedValueOnce(new Error('catalog unavailable'))
    expect((await POST(request({model:'qwen-plus',prompt:'你好',conversationId}))).status).toBe(409)
  })
  it('finishes the request record when the parallel catalog read fails',async()=>{
    m.catalog.mockRejectedValueOnce(new Error('catalog unavailable'))
    expect((await POST(request({model:'qwen-plus',prompt:'你好',conversationId}))).status).toBe(502)
    expect(m.ledger).toHaveBeenCalledWith('finish',expect.anything(),expect.objectContaining({status:'failed'}))
  })
  it.each(['裙子','复古衣服'])('searches %s without calling the intent model',async(prompt)=>{
    const spec=keywordSearchSpec(prompt)
    m.context.mockResolvedValue({userId:null,version:0,memories:[]})
    m.discover.mockResolvedValue({searchRunId:crypto.randomUUID(),sessionId:conversationId,query:spec.query,products:[],nextCursor:null,contextVersion:0,
      snapshotVersion:1,pageSize:20,returnedCount:0,candidateCount:0,question:null,spec})
    const response=await POST(request({model:'gemini',prompt,conversationId,retrieval:{mode:'hybrid',profile:'bge-small-zh-v1.5-512-v1'}}))
    expect(response.status).toBe(200)
    expect(m.classify).not.toHaveBeenCalled()
    expect(m.generate).not.toHaveBeenCalled()
    expect(m.discover.mock.calls[0][1]).toMatchObject({query:prompt,retrieval:{mode:'hybrid'}})
    expect(m.discover.mock.calls[0][5]).toMatchObject({version:expect.any(String),products:expect.any(Array)})
    expect((await response.json()).metrics.generationCalls).toBe(0)
  })
  it('honors the information scope on a new keyword request without searching the product catalog',async()=>{
    const response=await POST(request({model:'gemini',prompt:'earrings',searchScope:'information',conversationId}))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({informationQuery:'earrings',blocks:[{type:'information_feed'}],metrics:{modelCalls:0}})
    expect(m.classify).not.toHaveBeenCalled();expect(m.discover).not.toHaveBeenCalled()
  })
  it('does not force a greeting into information search and keeps the parser independent of the answer',async()=>{
    await POST(request({model:'gemini',prompt:'解释什么是金银镀层',searchScope:'information',conversationId}))
    expect(m.classify).toHaveBeenCalledWith(expect.objectContaining({model:'qwen-plus',scope:'information'}))
    expect(m.generate.mock.calls[0][0]).toBe('gemini')
  })
  it('applies an owned same-task edit without a model and preserves the full previous constraints',async()=>{
    const runId=crypto.randomUUID(),spec={...keywordSearchSpec('earrings'),maxPrice:100,currency:'USD',excludedTerms:['pearl']}
    m.context.mockResolvedValue({userId:null,version:0,memories:[]})
    m.owned.mockResolvedValue({id:runId,spec,context_version:0})
    m.discover.mockResolvedValue({searchRunId:crypto.randomUUID(),sessionId:conversationId,query:spec.query,products:[],nextCursor:null,contextVersion:0,
      snapshotVersion:1,pageSize:20,returnedCount:0,candidateCount:0,question:null,spec})
    const response=await POST(request({model:'gemini',prompt:'换成金色',conversationId,previousSearchRunId:runId,previousContextVersion:0,retrieval:{mode:'hybrid',profile:'bge-small-zh-v1.5-512-v1'}}))
    expect(response.status).toBe(200)
    expect(m.owned).toHaveBeenCalledWith(expect.objectContaining({sessionId:conversationId,userId:null}),runId)
    expect(m.discover.mock.calls[0][1]).toMatchObject({maxPrice:100,currency:'USD',excludedTerms:['pearl'],termGroups:[['耳环','耳饰','earring','earrings'],['金色','gold','golden']]})
    expect(m.discover.mock.calls[0][1].retrieval.mode).toBe('keyword')
    expect(await response.json()).toMatchObject({metrics:{modelCalls:0,executionPolicy:'deterministic-edit',requestedRetrieval:{mode:'hybrid'}}})
    expect(m.classify).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled()
  })
  it('rejects an unavailable previous search before any model or new discovery call',async()=>{
    const {DiscoveryError}=await import('@/lib/consumer-advisor/discovery-contract')
    m.owned.mockRejectedValue(new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。'))
    const response=await POST(request({model:'gemini',prompt:'换成金色',conversationId,previousSearchRunId:crypto.randomUUID()}))
    expect(response.status).toBe(404)
    expect(m.discover).not.toHaveBeenCalled();expect(m.classify).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled()
  })
  it('combines parser and answer usage for a single request',async()=>{
    m.classify.mockImplementation(async(input)=>{input.onCall();input.onUsage({inputTokens:11,outputTokens:3,cachedInputTokens:0});return {intent:'assistant',search:null,needsPersonalContext:false}})
    m.generate.mockImplementation(async(_model,_prompt,_system,options)=>{options.onCall();options.onUsage({inputTokens:21,outputTokens:7,cachedInputTokens:0});return '回答'})
    const result=await (await POST(request({model:'gemini',prompt:'解释这个概念',conversationId}))).json()
    expect(result.metrics).toMatchObject({modelCalls:2,usageScope:'request',usage:{inputTokens:32,outputTokens:10},totalInputTokens:32,cost:null})
    expect(result.metrics.modelStages.map((stage:{stage:string})=>stage.stage)).toEqual(['parse','answer'])
  })
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
  it('defers proposal consolidation without claiming a memory was already saved',async () => {
    m.getUser.mockResolvedValue({data:{user:{id:userId,user_metadata:{}}},error:null})
    m.validate.mockResolvedValue({text:'偏好木质家具',domain:'space',origin:'user',evidence:'我喜欢木质家具',supports:[],supersedeIds:['old-id']})
    const response = await POST(request({model:'qwen-plus',prompt:'我喜欢木质家具',conversationId,messageId:'proposal-message'}))
    expect(response.status).toBe(200)
    expect(m.manage).not.toHaveBeenCalled()
    expect(background.after).toHaveBeenCalledTimes(1)
    expect(background.consolidate).not.toHaveBeenCalled()
    await background.after.mock.calls[0][0]()
    expect(background.consolidate).toHaveBeenCalledWith(userId)
    expect(await response.json()).toMatchObject({memorySaved:false,memoryProposed:false})
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
  it('returns an explicit keyword page with zero classifier, answer and legacy search calls',async()=>{
    const spec={query:'沙发',termGroups:[['沙发']],excludedTerms:[],minPrice:null,maxPrice:null,currency:'CNY',type:'商品',sessionTerms:[],questionDismissed:false}
    const page={searchRunId:crypto.randomUUID(),sessionId:conversationId,query:'沙发',products:[],nextCursor:null,contextVersion:0,
      snapshotVersion:1,pageSize:20,returnedCount:0,candidateCount:0,question:null,spec}
    m.classify.mockResolvedValue({intent:'product-search',search:spec})
    m.discover.mockResolvedValue(page)
    const response=await POST(request({model:'qwen-plus',prompt:'沙发',conversationId}))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({status:'completed',discovery:page,model:null,source:'discovery-engine'})
    expect(m.classify).not.toHaveBeenCalled()
    expect(m.generate).not.toHaveBeenCalled();expect(m.search).not.toHaveBeenCalled();expect(m.plan).not.toHaveBeenCalled()
  })
  it('returns a catalog failure with a reusable specification instead of a fabricated empty page',async()=>{
    const {DiscoveryError}=await import('@/lib/consumer-advisor/discovery-contract')
    const spec=keywordSearchSpec('沙发')
    m.classify.mockResolvedValue({intent:'product-search',search:spec})
    m.discover.mockRejectedValue(new DiscoveryError('CATALOG_UNAVAILABLE',503,'商品暂时无法读取，请重试。'))
    const response=await POST(request({model:'qwen-plus',prompt:'沙发',conversationId}))
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({status:'failed',code:'CATALOG_UNAVAILABLE',retrySpec:{query:'沙发',retrieval:{mode:'auto'}},blocks:[]})
    expect(m.generate).not.toHaveBeenCalled()
  })
  it('parses a natural language product request once and preserves the chosen retrieval profile',async()=>{
    const spec=keywordSearchSpec('earrings')
    const page={searchRunId:crypto.randomUUID(),sessionId:conversationId,query:spec.query,products:[],nextCursor:null,contextVersion:0,
      snapshotVersion:1,pageSize:20,returnedCount:0,candidateCount:0,question:null,spec}
    m.classify.mockResolvedValue({intent:'product-search',search:spec,needsPersonalContext:false})
    m.discover.mockResolvedValue(page)
    const retrieval={mode:'hybrid',profile:'qwen-text-embedding-v4-1024-v1'}
    const response=await POST(request({model:'qwen-plus',prompt:'Find some delicate earrings for a wedding',conversationId,retrieval}))
    expect(response.status).toBe(200);expect(m.classify).toHaveBeenCalledTimes(1);expect(m.generate).not.toHaveBeenCalled()
    expect(m.discover.mock.calls[0][1]).toMatchObject({retrieval})
    expect(m.context).toHaveBeenCalledWith(null,{query:'earrings',preferences:false})
  })
  it('accepts an explicit search spec without requiring an answer model',async()=>{
    const spec=keywordSearchSpec('耳环')
    m.discover.mockResolvedValue({searchRunId:crypto.randomUUID(),sessionId:conversationId,query:spec.query,products:[],nextCursor:null,contextVersion:0,
      snapshotVersion:1,pageSize:20,returnedCount:0,candidateCount:0,question:null,spec})
    const response=await POST(request({action:{type:'search',spec},conversationId}))
    expect(response.status).toBe(200);expect(m.classify).not.toHaveBeenCalled();expect(m.generate).not.toHaveBeenCalled()
    expect(await response.json()).toMatchObject({metrics:{generationCalls:0,embeddingCalls:0,modelCalls:0}})
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
  it('resolves guest product references only through the approved shared catalog',async()=>{
    const id=readConsumerCatalog()[0].id
    m.classify.mockResolvedValue({intent:'product-question',search:null,needsPersonalContext:false,needsSourceContext:false})
    const response=await POST(request({model:'qwen-plus',prompt:'这件的材质是什么',conversationId,previousProductIds:[id,'invalid']}))
    expect(response.status).toBe(200);expect(m.byIds).not.toHaveBeenCalled()
    expect(String(m.generate.mock.calls[0][1])).toContain(id)
    expect(String(m.generate.mock.calls[0][1])).not.toContain('invalid')
  })
  it('uses server history for authenticated product references',async()=>{
    m.getUser.mockResolvedValue({data:{user:{id:userId,user_metadata:{}}},error:null})
    m.classify.mockResolvedValue({intent:'product-question',search:null,needsPersonalContext:false,needsSourceContext:false})
    expect((await POST(request({model:'qwen-plus',prompt:'这件的材质是什么',conversationId,previousProductIds:[crypto.randomUUID()]}))).status).toBe(200)
    expect(m.byIds).not.toHaveBeenCalled()
  })
})

it('loads the installed personal assistant for explicit skill requests without using its client text as system instructions', async () => {
  const response = await POST(request({model:'qwen-plus',prompt:'想了解个人风格',skillId:'personal-advisor',conversationId}))
  expect(response.status).toBe(200)
  expect(String(m.generate.mock.calls[0][2])).toContain('# 个人助手')
  expect(String(m.generate.mock.calls[0][2])).toContain('没有向模型开放 Python')
  expect(m.classify).not.toHaveBeenCalled()
})
it('rejects unknown skills before attempting to read any skill file', async () => {
  const response = await POST(request({model:'qwen-plus',prompt:'你好',skillId:'../../.env',conversationId}))
  expect(response.status).toBe(400)
  expect(m.generate).not.toHaveBeenCalled()
})
it('includes the personal assistant instructions for image analysis', async () => {
  const { readFile } = await import('node:fs/promises')
  const image = `data:image/png;base64,${(await readFile('public/consumer-market/skills/personal-assistant/oil_all.png')).toString('base64')}`
  const response = await POST(request({model:'gemini',prompt:'我想了解肤质',skillId:'personal-advisor',
    image,conversationId}))
  expect(response.status).toBe(200)
  expect(m.generate.mock.calls.some((call) => String(call[2]).includes('# 个人助手'))).toBe(true)
})
