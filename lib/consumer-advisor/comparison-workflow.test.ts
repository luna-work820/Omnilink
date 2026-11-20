import { beforeEach,describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
const m=vi.hoisted(()=>({store:vi.fn(),context:vi.fn(),catalog:vi.fn(),fetchSource:vi.fn(),saveSource:vi.fn(),sources:vi.fn()}))
vi.mock('./execution-store',async(original)=>({...await original<typeof import('./execution-store')>(),taskStore:m.store,saveExternalSource:m.saveSource,readOwnedSources:m.sources}))
vi.mock('./personal-context',()=>({loadPersonalContext:m.context}))
vi.mock('./external-source',()=>({fetchExternalSource:m.fetchSource,externalUrl:(url:string)=>new URL(url)}))
vi.mock('@/lib/products/consumer-catalog-store',()=>({
  readPublishedConsumerCatalog:async()=>({products:await m.catalog(),version:'test'}),
  selectCatalogProducts:(products:{id:string}[],requested:string[])=>requested.flatMap((id)=>products.filter((product)=>product.id===id)),
}))
import catalogData from '@/components/consumer-market/data/five-store-demo-products.json'
import { advanceComparisonTask,readComparisonTask,createComparisonTask,buildComparison } from './comparison-workflow'
import type { TaskRecord } from './execution-store'
import { DiscoveryError } from './discovery-contract'

const actor={userId:crypto.randomUUID(),guestHash:null,sessionId:crypto.randomUUID()}
const fixtures=catalogData.slice(0,2)
const ids=fixtures.map((product)=>product.id)
let record:TaskRecord
beforeEach(()=>{
  vi.clearAllMocks()
  record={id:crypto.randomUUID(),session_id:actor.sessionId,input:{productIds:ids,urls:[]},status:'pending',checkpoints:{},revision:1,attempt:0,lease:null,
    lease_until:null,error_code:null,result:null,updated_at:new Date().toISOString()}
  m.store.mockImplementation(async(action:string,_actor:unknown,input:Record<string,any>)=>{
    if(action==='claim') {
      if(['completed','cancelled','failed'].includes(record.status))return structuredClone(record)
      record={...record,status:'running',lease:crypto.randomUUID(),attempt:Math.max(record.attempt,1),revision:record.revision+1}
      return{...structuredClone(record),claimed:true}
    }
    if(['checkpoint','complete','pause','fail'].includes(action)&&record.status!=='running')throw new DiscoveryError('EXECUTION_CHANGED',409,'Changed')
    if(action==='checkpoint')record={...record,checkpoints:{...record.checkpoints,[input.step]:input.output},revision:record.revision+1}
    if(action==='pause')record={...record,status:'paused',lease:null,revision:record.revision+1}
    if(action==='complete')record={...record,status:'completed',result:input.result,lease:null,revision:record.revision+1}
    if(action==='fail')record={...record,status:'failed',error_code:input.errorCode,revision:record.revision+1}
    return structuredClone(record)
  })
  m.context.mockResolvedValue({version:0,memories:[]})
  m.sources.mockResolvedValue([])
  m.catalog.mockReturnValue(fixtures)
  m.fetchSource.mockResolvedValue({url:'https://example.com',title:'资料',excerpt:'公开网页正文'})
  m.saveSource.mockResolvedValue({id:crypto.randomUUID(),title:'资料',excerpt:'公开网页正文',url:'https://example.com',source:'example.com',entityType:'source',imageUrl:null,version:1,updatedAt:new Date().toISOString()})
})
describe('real Mastra comparison execution',()=>{
  it('persists the URL goal and selected fields and uses them after continuation and reread',async()=>{
    const input={productIds:ids,urls:[],goal:'比较材质和尺寸',requestedFields:['material','size'] as const}
    await createComparisonTask(actor,'goal-request',{...input,requestedFields:[...input.requestedFields]})
    expect(m.store).toHaveBeenCalledWith('create',actor,expect.objectContaining({input:expect.objectContaining({goal:input.goal,requestedFields:['material','size']})}))
    record.input={...input,requestedFields:[...input.requestedFields]}
    for(let i=0;i<4;i++)await advanceComparisonTask(actor,record.id)
    expect(record.result).toMatchObject({goal:'比较材质和尺寸',rows:[{label:'材质'},{label:'尺寸'}]})
    expect(record.result?.rows[0].values).toEqual(fixtures.map((product)=>product.specs['材质']))
    expect((await readComparisonTask(actor,'get',record.id)).result?.rows.map((row)=>row.label)).toEqual(['材质','尺寸'])
  })
  it('keeps absent URL properties unknown and labels matching webpage text as unverified',()=>{
    const source={id:crypto.randomUUID(),entityType:'source' as const,title:'网页',excerpt:'Material: recycled silver. Shipping worldwide.',
      url:'https://example.com',imageUrl:null,source:'example.com',version:1,updatedAt:new Date().toISOString()}
    const result=buildComparison([], [source],0,{goal:'Compare material and size'})
    expect(result.rows[0].values[0]).toContain('未核验')
    expect(result.rows[1].values).toEqual(['资料未提供'])
  })
  it('uses persisted checkpoints across independent workflow runs and executes one new tool per continuation',async()=>{
    const started=performance.now()
    for(let i=0;i<4;i++) {
      const task=await advanceComparisonTask(actor,record.id)
      expect(task.completedSteps).toHaveLength(i+1)
      expect(task.status).toBe(i===3?'completed':'paused')
    }
    expect(record.result?.columns).toHaveLength(2)
    expect(record.result?.rows[0].values).toEqual(fixtures.map((product)=>product.formattedPrice))
    expect(m.context).toHaveBeenCalledTimes(2)
    expect(m.catalog).toHaveBeenCalledTimes(2)
    expect(m.fetchSource).not.toHaveBeenCalled()
    const count=m.catalog.mock.calls.length
    expect((await advanceComparisonTask(actor,record.id)).status).toBe('completed')
    expect(m.catalog).toHaveBeenCalledTimes(count+1)
    console.info(JSON.stringify({comparisonFixtureMs:Math.round(performance.now()-started),newTools:4,modelCalls:0}))
  })
  it('revalidates a publication before the comparison instead of trusting old product checkpoints',async()=>{
    for(let i=0;i<3;i++)await advanceComparisonTask(actor,record.id)
    m.catalog.mockReturnValue([])
    const result=await advanceComparisonTask(actor,record.id)
    expect(result.result?.columns).toEqual([])
    expect(result.result?.unknowns).toContain('部分商品已下架或不可公开读取。')
  })
  it('rejects changed preference versions before producing a result',async()=>{
    for(let i=0;i<3;i++)await advanceComparisonTask(actor,record.id)
    m.context.mockResolvedValue({version:1,memories:[]})
    const result=await advanceComparisonTask(actor,record.id)
    expect(result.status).toBe('failed')
    expect(result.error).toBe('CONTEXT_CHANGED')
    expect(result.result).toBeNull()
  })
  it('revalidates saved results after publication withdrawal without rerunning the workflow',async()=>{
    for(let i=0;i<4;i++)await advanceComparisonTask(actor,record.id)
    expect(record.result?.columns).toHaveLength(2)
    m.catalog.mockReturnValue([])
    const result=await readComparisonTask(actor,'get',record.id)
    expect(result.result?.columns).toEqual([])
    expect(result.result?.unknowns).toContain('部分商品已下架或不可公开读取。')
    expect(m.store.mock.calls.at(-1)?.[0]).toBe('get')
    expect(result.revision).toBe(record.revision)
  })
  it('starts both independent URL reads without waiting for the first download',async()=>{
    record.input.urls=['https://example.com/','https://example.org/']
    await advanceComparisonTask(actor,record.id);await advanceComparisonTask(actor,record.id)
    let release!:()=>void
    const bothStarted=new Promise<void>((resolve)=>{release=resolve})
    m.fetchSource.mockImplementation(async(url:string)=>{
      if(m.fetchSource.mock.calls.length===2)release()
      await bothStarted
      return {url,title:'公开资料',excerpt:'足够长的公开资料正文。'}
    })
    const result=await advanceComparisonTask(actor,record.id)
    expect(result.status).toBe('paused');expect(m.fetchSource).toHaveBeenCalledTimes(2);expect(m.saveSource).toHaveBeenCalledTimes(2)
  },2000)
})
