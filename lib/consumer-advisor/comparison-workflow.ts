import 'server-only'
import { createStep,createWorkflow } from '@mastra/core/workflows'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { mapStorefrontDiscoveryRows } from '@/lib/storefront/service'
import { toConsumerProduct } from './consumer-product'
import { loadPersonalContext } from './personal-context'
import { fetchExternalSource,externalUrl } from './external-source'
import { taskStore,taskView,saveExternalSource,readOwnedSources,type Actor,type TaskRecord } from './execution-store'
import type { ComparisonResult,InformationItem } from './response-contract'
import { compareInputSchema } from './response-contract'
import { DiscoveryError } from './discovery-contract'
import type { ProductItem } from '@/components/consumer-market/types'

const STEP_IDS=['context','products','sources','comparison'] as const
const frameSchema=z.object({taskId:z.string().uuid()})

async function publishedProducts(ids:string[]):Promise<ProductItem[]> {
  if(!ids.length)return []
  const {data,error}=await createServiceRoleClient().from('discovery_products')
    .select('id,title,description,created_at,publisher_name,publisher_slug,cover_image,price,currency_code,price_mode,xiaohongshu_url,douyin_url,item_type,delivery_type,capability_kind,category')
    .in('id',ids).abortSignal(AbortSignal.timeout(8000))
  if(error)throw new DiscoveryError('CATALOG_UNAVAILABLE',503,'商品暂时无法读取。')
  const products=mapStorefrontDiscoveryRows(data??[]).map(toConsumerProduct)
  return ids.flatMap((id)=>products.filter((product)=>product.id===id))
}

export function buildComparison(products:ProductItem[],sources:InformationItem[],requestedCount:number):ComparisonResult {
  const columns=[...products.map((p)=>({id:p.id,title:p.name,url:`/store/${encodeURIComponent(p.storeSlug??'')}/products/${p.id}`})),
    ...sources.map((s)=>({id:s.id,title:s.title,url:s.url}))]
  const unknowns:string[]=[]
  if(products.length<requestedCount)unknowns.push('部分商品已下架或不可公开读取。')
  if(columns.length<2)unknowns.push('可用资料少于两项，暂不能完成完整对比。')
  return {title:'商品与资料对比',columns,rows:[
    {label:'价格',values:[...products.map((p)=>p.formattedPrice),...sources.map(()=> '未核验')]},
    {label:'来源',values:[...products.map((p)=>p.storeName),...sources.map((s)=>s.source)]},
    {label:'资料',values:[...products.map((p)=>p.shortDescription.slice(0,240)||'未提供'),...sources.map((s)=>s.excerpt.slice(0,240))]},
  ],sources,unknowns}
}

export async function createComparisonTask(actor:Actor,requestId:string,input:unknown) {
  const parsed=compareInputSchema.parse(input)
  const normalized={productIds:[...new Set(parsed.productIds)],urls:[...new Set(parsed.urls.map((url)=>externalUrl(url).href))]}
  return taskView(await taskStore('create',actor,{requestId,input:normalized}))
}

async function currentTaskView(actor:Actor,record:TaskRecord) {
  const view=taskView(record)
  if(record.status==='completed'&&record.result) {
    const [products,sources]=await Promise.all([publishedProducts(record.input.productIds),readOwnedSources(actor,record.result.sources.map((source)=>source.id))])
    view.result=buildComparison(products,sources,record.input.productIds.length)
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
    execute:async()=>guard(async()=>({version:(await loadPersonalContext(actor.userId)).version}))})
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
      const [latest,products,owned]=await Promise.all([loadPersonalContext(actor.userId),publishedProducts(input.productIds),readOwnedSources(actor,stored.map((source)=>source.id))])
      if(latest.version!==context.data.version)throw new DiscoveryError('CONTEXT_CHANGED',409,'偏好已更新，请重新确认任务。')
      const sources=owned.filter((source)=>stored.some((previous)=>previous.id===source.id&&previous.version===source.version))
      return buildComparison(products,sources,input.productIds.length)
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
