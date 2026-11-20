import 'server-only'
import { createStep,createWorkflow } from '@mastra/core/workflows'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { readPublishedConsumerCatalog,selectCatalogProducts } from '@/lib/products/consumer-catalog-store'
import { loadPersonalContext } from './personal-context'
import { fetchExternalSource,externalUrl } from './external-source'
import { taskStore,taskView,saveExternalSource,readOwnedSources,type Actor,type TaskRecord } from './execution-store'
import type { CompareInput,ComparisonResult,InformationItem } from './response-contract'
import { compareInputSchema } from './response-contract'
import { DiscoveryError } from './discovery-contract'
import type { ProductItem } from '@/components/consumer-market/types'

const STEP_IDS=['context','products','sources','comparison'] as const
const frameSchema=z.object({taskId:z.string().uuid()})

async function publishedProducts(ids:string[]):Promise<ProductItem[]> {
  return selectCatalogProducts((await readPublishedConsumerCatalog()).products,ids)
}

export function buildComparison(products:ProductItem[],sources:InformationItem[],requestedCount:number,request:Pick<CompareInput,'goal'|'requestedFields'>={}):ComparisonResult {
  const columns=[...products.map((p)=>({id:p.id,title:p.name,url:p.sourceUrl??`/store/${encodeURIComponent(p.storeSlug??'')}/products/${p.id}`})),
    ...sources.map((s)=>({id:s.id,title:s.title,url:s.url}))]
  const unknowns:string[]=[]
  if(products.length<requestedCount)unknowns.push('部分商品已下架或不可公开读取。')
  if(columns.length<2)unknowns.push('可用资料少于两项，暂不能完成完整对比。')
  const rules = [
    {field:'price' as const,label:'价格',pattern:/价格|预算|price|cost/i},
    {field:'material' as const,label:'材质',pattern:/材质|材料|material|metal|ingredient|成分/i},
    {field:'size' as const,label:'尺寸',pattern:/尺寸|大小|长度|size|length|dimension/i},
    {field:'color' as const,label:'颜色',pattern:/颜色|colou?r/i},
    {field:'source' as const,label:'来源',pattern:/来源|品牌|source|brand/i},
    {field:'summary' as const,label:'资料',pattern:/摘要|概括|总结|summary|summari[sz]e/i},
  ]
  const inferred=rules.filter((rule)=>rule.pattern.test(request.goal??'')).map((rule)=>rule.field)
  const selected=request.requestedFields?.length?[...new Set(request.requestedFields)]:inferred.length?inferred:['price','source','summary']
  if(request.goal&&!inferred.length&&!request.requestedFields?.length)unknowns.push('当前仅展示已有事实；具体目标尚需进一步核对。')
  const rows=selected.map((field)=>{
    const rule=rules.find((rule)=>rule.field===field)!
    const values=products.map((p)=>{
      if(field==='price')return p.formattedPrice
      if(field==='source')return p.storeName
      if(field==='summary')return p.shortDescription.slice(0,240)||'未提供'
      return Object.entries(p.specs??{}).filter(([key])=>rule.pattern.test(key)).map(([,value])=>value).join('；').slice(0,1000)||'资料未提供'
    })
    return {label:rule.label,values:[...values,...sources.map((source)=>{
      if(field==='source')return source.source
      if(field==='summary')return source.excerpt.slice(0,240)
      const lines=source.excerpt.split(/[\n。；;]/).filter((line)=>rule.pattern.test(line)).slice(0,2)
      return lines.length?'网页原文（未核验）：'+lines.join('；').slice(0,900):'资料未提供'
    })]}
  })
  return {title:request.goal?.slice(0,160)||'商品与资料对比',goal:request.goal,columns,rows,sources,unknowns}
}

export async function createComparisonTask(actor:Actor,requestId:string,input:unknown) {
  const parsed=compareInputSchema.parse(input)
    const normalized={productIds:[...new Set(parsed.productIds)],urls:[...new Set(parsed.urls.map((url)=>externalUrl(url).href))],
      ...(parsed.goal?{goal:parsed.goal}:{}),...(parsed.requestedFields?.length?{requestedFields:[...new Set(parsed.requestedFields)]}:{})}
  return taskView(await taskStore('create',actor,{requestId,input:normalized}))
}

async function currentTaskView(actor:Actor,record:TaskRecord) {
  const view=taskView(record)
  if(record.status==='completed'&&record.result) {
    const [products,sources]=await Promise.all([publishedProducts(record.input.productIds),readOwnedSources(actor,record.result.sources.map((source)=>source.id))])
    view.result=buildComparison(products,sources,record.input.productIds.length,record.input)
  }
  return view
}
export async function readComparisonTask(actor:Actor,action:'get'|'retry'|'cancel',id:string) {
  return currentTaskView(actor,await taskStore(action,actor,{id}))
}

export async function advanceComparisonTask(actor:Actor,id:string,signal?:AbortSignal) {
  const record=await taskStore('claim',actor,{id})
  if(!record.claimed)return currentTaskView(actor,record)
  const input=compareInputSchema.parse(record.input)
  let current:TaskRecord=record,newToolExecuted=false
  let toolFailure:unknown
  const guard=async<T>(action:()=>Promise<T>):Promise<T>=>{try{return await action()}catch(error){toolFailure=error;throw error}}
  const contextTool=createTool({id:'read-confirmed-context',description:'读取当前账号已确认的个人上下文版本。',inputSchema:z.object({}),outputSchema:z.object({version:z.number()}),
    execute:async()=>guard(async()=>({version:(await loadPersonalContext(actor.userId,{query:'',preferences:false})).version}))})
  const productsTool=createTool({id:'read-published-products',description:'只读取本任务所选的公开商品。',inputSchema:z.object({}),outputSchema:z.array(z.custom<ProductItem>()),
    execute:async()=>guard(()=>publishedProducts(input.productIds))})
  const sourcesTool=createTool({id:'read-user-provided-sources',description:'读取用户明确提供的公开 HTTPS 网页并保留来源。',inputSchema:z.object({}),outputSchema:z.array(z.custom<InformationItem>()),
    execute:async()=>guard(async()=>{
      return Promise.all(input.urls.map(async(url)=>{
        signal?.throwIfAborted()
        return saveExternalSource(actor,await fetchExternalSource(url,signal),{id,lease:record.lease})
      }))
    })})
  const comparisonTool=createTool({id:'compare-verified-facts',description:'重新核对发布状态与上下文版本，汇总价格、来源及未知项。',inputSchema:z.object({}),outputSchema:z.custom<ComparisonResult>(),
    execute:async()=>guard(async()=>{
      const context=current.checkpoints.context as {data:{version:number}}
      const stored=(current.checkpoints.sources as {data:InformationItem[]}).data
      const [latest,products,owned]=await Promise.all([loadPersonalContext(actor.userId,{query:'',preferences:false}),publishedProducts(input.productIds),readOwnedSources(actor,stored.map((source)=>source.id))])
      if(latest.version!==context.data.version)throw new DiscoveryError('CONTEXT_CHANGED',409,'偏好已更新，请重新确认任务。')
      const sources=owned.filter((source)=>stored.some((previous)=>previous.id===source.id&&previous.version===source.version))
      return buildComparison(products,sources,input.productIds.length,input)
    })})
  const tools={context:contextTool,products:productsTool,sources:sourcesTool,comparison:comparisonTool}
  const steps=STEP_IDS.map((step)=>createStep({id:`compare-${step}`,inputSchema:frameSchema,outputSchema:frameSchema,
    execute:async({inputData,bail})=>{
      if(step in current.checkpoints)return inputData
      if(newToolExecuted)return bail(inputData)
      signal?.throwIfAborted()
      const started=performance.now()
      const tool=tools[step]
      const output=await tool.execute!({}, {abortSignal:signal})
      current=await guard(()=>taskStore('checkpoint',actor,{id,lease:record.lease,step,output:{data:output,durationMs:Math.round(performance.now()-started),modelCalls:0}}))
      newToolExecuted=true
      return inputData
    }}))
  const workflow=createWorkflow({id:'consumer-verified-comparison-v1',inputSchema:frameSchema,outputSchema:frameSchema})
    .then(steps[0]).then(steps[1]).then(steps[2]).then(steps[3]).commit()
  try {
    const run=await workflow.createRun({runId:crypto.randomUUID(),shouldPersistSnapshot:()=>false})
    const result=await run.start({inputData:{taskId:id}})
    if(result.status==='failed')throw result.error
    const done=STEP_IDS.every((step)=>step in current.checkpoints)
    const next=await taskStore(done?'complete':'pause',actor,{id,lease:record.lease,...(done?{result:(current.checkpoints.comparison as {data:ComparisonResult}).data}:{})})
    return taskView(next)
  } catch(error) {
    const cause=toolFailure??error
    if(cause instanceof DiscoveryError&&cause.code==='EXECUTION_CHANGED')return taskView(await taskStore('get',actor,{id}))
    const code=cause instanceof DiscoveryError?cause.code:signal?.aborted?'INTERRUPTED':'TOOL_UNAVAILABLE'
    return taskView(await taskStore('fail',actor,{id,lease:record.lease,errorCode:code}))
  }
}
