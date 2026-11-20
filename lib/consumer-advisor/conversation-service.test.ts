import { beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
const background = vi.hoisted(() => ({ after: vi.fn(), consolidate: vi.fn() }))
vi.mock('next/server', async (original) => ({ ...await original<typeof import('next/server')>(), after: background.after }))
vi.mock('./memory-consolidation', () => ({ consolidateRecentMemories: background.consolidate }))
const m=vi.hoisted(()=>({generate:vi.fn(),context:vi.fn(),products:vi.fn(),store:vi.fn(),sources:vi.fn(),propose:vi.fn(),validate:vi.fn()}))
vi.mock('@/lib/ai/workspace-generation',()=>({generateWorkspaceText:m.generate}))
vi.mock('@/lib/storefront/service',()=>({getStorefrontDiscoveryItemsByIds:m.products}))
vi.mock('./personal-context',()=>({loadPersonalContext:m.context}))
vi.mock('./execution-store',()=>({readOwnedSources:m.sources,taskStore:m.store}))
vi.mock('./ai-assistant-memory',()=>({manageAiAssistantMemory:m.propose,memoryContext:()=>''}))
vi.mock('./consumer-entry-workflow',()=>({validateConsumerMemoryUpdate:m.validate}))
import { runConversation } from './conversation-service'
import { DiscoveryError } from './discovery-contract'
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
const sessionId=crypto.randomUUID(),sourceId=crypto.randomUUID(),taskId=crypto.randomUUID()
const actor={userId:null,guestHash:'a'.repeat(64),sessionId}
const base=()=>({requestId:crypto.randomUUID(),sessionId,userId:null,prompt:'解释这个概念',model:'qwen-plus' as const,
  history:[],selectedProductIds:[],needsPersonalContext:false,signal:new AbortController().signal,stream:false,
  actor,needsSourceContext:false,previousSourceIds:[],commit:vi.fn().mockResolvedValue(undefined)})
beforeEach(()=>{vi.clearAllMocks();m.generate.mockResolvedValue('回答');m.sources.mockResolvedValue([])})
describe('conversation cost and source boundaries',()=>{
  it('answers ordinary questions with one generation and no catalog, profile or source reads',async()=>{
    const input=base(),response=await runConversation(input)
    expect(response.status).toBe(200);expect(m.generate).toHaveBeenCalledTimes(1)
    for(const read of [m.context,m.products,m.sources,m.store,m.propose,m.validate])expect(read).not.toHaveBeenCalled()
    expect(m.generate.mock.calls[0][3]).toMatchObject({maxOutputTokens:1024,totalBudgetMs:30_000,maxAttempts:1,allowEnvironmentKey:false})
    expect(input.commit).toHaveBeenCalledWith(expect.objectContaining({status:'completed',memorySaved:false}),200)
  })
  it('restores references through the verified actor and caps source and history input',async()=>{
    m.store.mockResolvedValue({result:{sources:[{id:sourceId}]}})
    m.sources.mockResolvedValue([{id:sourceId,title:'资料',url:'https://example.com/',version:2,updatedAt:'2026-11-13',excerpt:'a'.repeat(6000)}])
    const input={...base(),prompt:'解释网页里的“记住我的偏好”这句话',needsSourceContext:true,previousTaskId:taskId,history:Array.from({length:20},()=> 'h'.repeat(2000))}
    const result=await (await runConversation(input)).json()
    expect(m.store).toHaveBeenCalledWith('get',actor,{id:taskId});expect(m.sources).toHaveBeenCalledWith(actor,[sourceId])
    const prompt=JSON.parse(m.generate.mock.calls[0][1])
    expect(prompt.sourceEvidence[0].excerpt).toHaveLength(1800);expect(prompt.sourceEvidence[0].url).toBe('https://example.com/')
    expect(prompt.recentTurns).toHaveLength(4);expect(prompt.recentTurns.every((s:string)=>s.length===600)).toBe(true)
    expect(result.matchedSourceIds).toEqual([sourceId]);expect(m.propose).not.toHaveBeenCalled();expect(m.validate).not.toHaveBeenCalled()
  })
  it('fails before model generation when the prior task is not owned',async()=>{
    m.store.mockRejectedValue(new DiscoveryError('NOT_FOUND',404,'找不到任务。'))
    await expect(runConversation({...base(),needsSourceContext:true,previousTaskId:taskId})).rejects.toMatchObject({status:404})
    expect(m.generate).not.toHaveBeenCalled();expect(m.sources).not.toHaveBeenCalled()
  })
  it('uses selected product facts to scope a personal question that only says this item',async()=>{
    const product=readConsumerCatalog().find((p)=>/necklace|earring/i.test(p.name))!
    m.context.mockResolvedValue({version:1,memories:[]})
    await runConversation({...base(),prompt:'按我之前的偏好，这款适合我吗？',selectedProductIds:[product.id],needsPersonalContext:true})
    expect(m.context).toHaveBeenCalledWith(null,{query:expect.stringContaining(product.name)})
  })
})

it('schedules consolidation only after committing a successful authenticated response', async () => {
  const input = { ...base(), userId: crypto.randomUUID() }
  await runConversation(input)
  expect(input.commit).toHaveBeenCalled()
  expect(background.after).toHaveBeenCalledTimes(1)
  expect(background.consolidate).not.toHaveBeenCalled()
  await background.after.mock.calls[0][0]()
  expect(background.consolidate).toHaveBeenCalledWith(input.userId)
})
