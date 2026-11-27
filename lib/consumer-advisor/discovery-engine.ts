import 'server-only'
import { createHash,createHmac,randomBytes,randomUUID,timingSafeEqual } from 'node:crypto'
import type { NextRequest,NextResponse } from 'next/server'
import { z } from 'zod'
import type { ProductItem } from '@/components/consumer-market/types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { readPublishedConsumerCatalog,selectCatalogProducts,type ConsumerCatalogSnapshot } from '@/lib/products/consumer-catalog-store'
import { retrieveDiscoveryCandidates } from './discovery-retrieval'
import { eligibleConsumerProduct,rankKeywordProducts,keywordProductScore,spreadStores } from './search-spec'
import type { RetrievalReport } from './embedding-profile'
import { DISCOVERY_INSIGHT_SAMPLE_SIZE,DiscoveryError,discoverySpecSchema,type DiscoveryPage,type DiscoverySpec } from './discovery-contract'
import { loadPersonalContext,resolvePersonalContext,type PersonalContextSnapshot } from './personal-context'
import type { ExchangeRates } from './exchange-rates'

const GUEST_COOKIE='omnilink_discovery_guest'
export type DiscoveryActor={userId:string|null;guestHash:string|null;sessionId:string;newGuestToken?:string}
type Run={id:string;spec:DiscoverySpec;user_id:string|null;guest_hash:string|null;session_id:string;context_version:number;expires_at:string}
type Execution={catalogVersion:string;candidateKeys:string[];retrieval:RetrievalReport;priceReference?:ExchangeRates|null;priceWarning?:boolean}
type DbPage={id:string;spec:DiscoverySpec;sessionId:string;contextVersion:number;expiresAt:string;execution:Execution}
const cursorSchema=z.object({r:z.string().uuid(),s:z.string().uuid(),o:z.number().int().min(0).max(1000),v:z.number().int().nonnegative(),e:z.number().int().positive()}).strict()

export function discoveryActor(request:NextRequest,userId:string|null,sessionId:string):DiscoveryActor {
  if(userId) return {userId,guestHash:null,sessionId}
  const existing=request.cookies.get(GUEST_COOKIE)?.value
  const token=existing && /^[a-f0-9]{64}$/.test(existing)?existing:randomBytes(32).toString('hex')
  return {userId:null,guestHash:createHash('sha256').update(token).digest('hex'),sessionId,
    ...(token!==existing?{newGuestToken:token}:{})}
}
export function attachDiscoveryActor(response:NextResponse,actor:DiscoveryActor) {
  if(actor.newGuestToken) response.cookies.set(GUEST_COOKIE,actor.newGuestToken,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:3600})
  response.headers.set('Cache-Control','private, no-store')
  return response
}
function secret() {
  const value=process.env.DISCOVERY_CURSOR_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!value) throw new DiscoveryError('DISCOVERY_CONFIGURATION',503,'搜索配置暂时不可用。')
  return value
}
export function encodeDiscoveryCursor(value:z.infer<typeof cursorSchema>,key=secret()) {
  const payload=Buffer.from(JSON.stringify(cursorSchema.parse(value))).toString('base64url')
  return `${payload}.${createHmac('sha256',key).update(`discovery-v1:${payload}`).digest('base64url')}`
}
export function decodeDiscoveryCursor(token:string,key=secret()) {
  try {
    if(token.length>2048) throw new Error('Length')
    const parts=token.split('.')
    if(parts.length!==2) throw new Error('Shape')
    const expected=createHmac('sha256',key).update(`discovery-v1:${parts[0]}`).digest()
    const actual=Buffer.from(parts[1],'base64url')
    if(actual.length!==expected.length || !timingSafeEqual(actual,expected)) throw new Error('Signature')
    const value=cursorSchema.parse(JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')))
    if(value.e<=Date.now()) throw new DiscoveryError('SEARCH_EXPIRED',410,'搜索已过期，请刷新结果。')
    return value
  } catch(error) {
    if(error instanceof DiscoveryError) throw error
    throw new DiscoveryError('CURSOR_INVALID',400,'续页地址无效，请刷新结果。')
  }
}

function dbError(error:{code?:string;message?:string}):never {
  if(error.code==='P0002') throw new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。')
  if(error.code==='40001') throw new DiscoveryError('CONTEXT_CHANGED',409,'偏好已更新，请刷新结果。')
  if(error.message==='SEARCH_EXPIRED') throw new DiscoveryError('SEARCH_EXPIRED',410,'搜索已过期，请刷新结果。')
  if(error.message==='CURSOR_INVALID') throw new DiscoveryError('CURSOR_INVALID',400,'续页地址无效，请刷新结果。')
  throw new DiscoveryError('CATALOG_UNAVAILABLE',503,'商品暂时无法读取，请重试。')
}

type DiscoveryCommit = (run: Record<string, unknown>, page: DiscoveryPage) => Promise<boolean>

export type DiscoveryRouteMeta = {routeSource?:'rule'|'explicit'|'model'; keywordKind?:'category'|'name'|'brand'|'store'|'model'|'phrase'|null}

export async function startDiscovery(actor:DiscoveryActor,input:DiscoverySpec,snapshot?:PersonalContextSnapshot,signal?:AbortSignal,previousRun?:Run,publishedCatalog?:ConsumerCatalogSnapshot,commit?:DiscoveryCommit,routeMeta?:DiscoveryRouteMeta):Promise<DiscoveryPage> {
  const spec=discoverySpecSchema.parse(input)
  const [personalContext,catalog]=await Promise.all([
    snapshot?Promise.resolve(snapshot):spec.usePersonalContext?loadPersonalContext(actor.userId,{query:spec.query,preferences:true}):Promise.resolve({userId:actor.userId,version:0,memories:[]}),
    publishedCatalog?Promise.resolve(publishedCatalog):readPublishedConsumerCatalog(),
  ])
  const context={...resolvePersonalContext(personalContext,spec),...routeMeta}
  let previousRates:ExchangeRates|null|undefined
  if(previousRun) {
    const {data,error}=await createServiceRoleClient().rpc('read_consumer_discovery_execution',{
      p_run_id:previousRun.id,p_user_id:actor.userId,p_guest_hash:actor.guestHash,p_session_id:actor.sessionId,p_version:previousRun.context_version,
    }).abortSignal(signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000))
    if(error)dbError(error)
    if(!data)throw new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。')
    previousRates=(data as DbPage).execution.priceReference
  }
  const candidates=await retrieveDiscoveryCandidates(spec,context,signal,undefined,previousRates,catalog)
  signal?.throwIfAborted()
  const latestCatalog = await readPublishedConsumerCatalog()
  if (latestCatalog.version !== candidates.catalogVersion) throw new DiscoveryError('SEARCH_EXPIRED',410,'目录已更新，请刷新结果。')
  signal?.throwIfAborted()
  return saveDiscoveryExecution(actor,spec,context.version,candidates.products.map((product)=>product.id),candidates.report,candidates.catalogVersion,candidates.priceReference,candidates.priceWarning,catalog,commit)
}

async function saveDiscoveryExecution(actor:DiscoveryActor,spec:DiscoverySpec,version:number,keys:string[],report:RetrievalReport,catalogVersion:string,
  priceReference:ExchangeRates|null|undefined,priceWarning:boolean|undefined,snapshot:ConsumerCatalogSnapshot,commit?:DiscoveryCommit) {
  const run={id:randomUUID(),user_id:actor.userId,guest_hash:actor.guestHash,session_id:actor.sessionId,spec,
    candidate_ids:[],context_version:version,expires_at:new Date(Date.now()+15*60_000).toISOString(),
    execution:{catalogVersion,candidateKeys:keys,retrieval:report,priceReference:priceReference??null,priceWarning:priceWarning??false}}
  const pageRecord:DbPage={id:run.id,spec,sessionId:actor.sessionId,contextVersion:version,expiresAt:run.expires_at,execution:run.execution}
  const page = discoveryPageAt(actor,pageRecord,snapshot,0,true)
  if (commit && await commit(run, page)) return page
  const created=await createServiceRoleClient().rpc('create_consumer_discovery_run',{p_record:run}).abortSignal(AbortSignal.timeout(8000))
  if(created.error) dbError(created.error)
  return page
}

export async function refineDiscovery(actor:DiscoveryActor,run:Run,sessionTerms:string[]) {
  const {data,error}=await createServiceRoleClient().rpc('read_consumer_discovery_execution',{
    p_run_id:run.id,p_user_id:actor.userId,p_guest_hash:actor.guestHash,p_session_id:actor.sessionId,p_version:run.context_version,
  }).abortSignal(AbortSignal.timeout(8000))
  if(error)dbError(error)
  if(!data)throw new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。')
  const previous=data as DbPage
  const snapshot=await readPublishedConsumerCatalog()
  if(previous.execution.catalogVersion!==snapshot.version)throw new DiscoveryError('SEARCH_EXPIRED',410,'目录已更新，请刷新结果。')
  const spec=discoverySpecSchema.parse({...run.spec,sessionTerms,questionDismissed:true})
  const products=spreadStores(rankKeywordProducts(selectCatalogProducts(snapshot.products,previous.execution.candidateKeys),spec,[],[],previous.execution.priceReference,false),(product)=>keywordProductScore(product,spec))
  return saveDiscoveryExecution(actor,spec,run.context_version,products.map((product)=>product.id),{
    ...previous.execution.retrieval,embeddingCalls:0,embeddingInputTokens:0,embeddingMs:0,retrievalMs:0,totalMs:0,candidateCount:products.length,
  },snapshot.version,previous.execution.priceReference,previous.execution.priceWarning,snapshot)
}

export function pageCatalogExecution(spec:DiscoverySpec,execution:Execution,offset:number,catalog:ProductItem[],catalogVersion:string) {
  if(execution.catalogVersion!==catalogVersion)throw new DiscoveryError('SEARCH_EXPIRED',410,'目录已更新，请刷新结果。')
  if(offset<0||offset>execution.candidateKeys.length)throw new DiscoveryError('CURSOR_INVALID',400,'续页地址无效，请刷新结果。')
  const products=selectCatalogProducts(catalog,execution.candidateKeys.slice(offset))
  const byId=new Map(products.map((product)=>[product.id,product]))
  const page=[]
  let position=offset
  while(position<execution.candidateKeys.length&&page.length<20) {
    const product=byId.get(execution.candidateKeys[position++])
    if(product&&eligibleConsumerProduct(product,spec,execution.priceReference))page.push(product)
  }
  return {products:page,nextOffset:position<execution.candidateKeys.length?position:null}
}

function discoveryPageAt(actor:DiscoveryActor,page:DbPage,snapshot:ConsumerCatalogSnapshot,offset:number,initial=false):DiscoveryPage {
  const spec=discoverySpecSchema.parse(page.spec)
  const {products,nextOffset}=pageCatalogExecution(spec,page.execution,offset,snapshot.products,snapshot.version)
  return {searchRunId:page.id,sessionId:page.sessionId,query:spec.query,products,
    nextCursor:nextOffset===null?null:encodeDiscoveryCursor({r:page.id,s:actor.sessionId,o:nextOffset,v:Number(page.contextVersion),e:Date.parse(page.expiresAt)}),
    contextVersion:Number(page.contextVersion),snapshotVersion:1,pageSize:20,returnedCount:products.length,candidateCount:page.execution.candidateKeys.length,
    question:null,spec,priceReference:page.execution.priceReference??null,priceWarning:page.execution.priceWarning??false,
    retrieval:initial?page.execution.retrieval:{...page.execution.retrieval,embeddingCalls:0,embeddingInputTokens:0,embeddingMs:0,retrievalMs:0,totalMs:0}}
}

async function readDiscoveryPage(actor:DiscoveryActor,cursor:z.infer<typeof cursorSchema>,initial=false,catalogRead?:Promise<ConsumerCatalogSnapshot>):Promise<DiscoveryPage> {
  if(cursor.s!==actor.sessionId) throw new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。')
  const [execution,snapshot]=await Promise.all([
    createServiceRoleClient().rpc('read_consumer_discovery_execution',{
      p_run_id:cursor.r,p_user_id:actor.userId,p_guest_hash:actor.guestHash,p_session_id:actor.sessionId,p_version:cursor.v,
    }).abortSignal(AbortSignal.timeout(8000)),
    catalogRead ?? readPublishedConsumerCatalog(),
  ])
  const {data,error}=execution
  if(error) dbError(error)
  if(!data) throw new DiscoveryError('CATALOG_UNAVAILABLE',503,'商品暂时无法读取，请重试。')
  return discoveryPageAt(actor,data as DbPage,snapshot,cursor.o,initial)
}

export async function continueDiscovery(actor:DiscoveryActor,cursor:string,runId:string) {
  const parsed=decodeDiscoveryCursor(cursor)
  if(parsed.r!==runId) throw new DiscoveryError('CURSOR_INVALID',400,'续页地址无效，请刷新结果。')
  return readDiscoveryPage(actor,parsed)
}

export async function resumeDiscovery(actor:DiscoveryActor,runId:string,version:number) {
  return readDiscoveryPage(actor,{r:runId,s:actor.sessionId,o:0,v:version,e:Date.now()+15*60_000})
}

export async function ownedDiscoveryRun(actor:DiscoveryActor,id:string):Promise<Run> {
  let query=createServiceRoleClient().from('consumer_discovery_runs')
    .select('id,spec,user_id,guest_hash,session_id,context_version,expires_at').eq('id',id).eq('session_id',actor.sessionId)
  query=actor.userId?query.eq('user_id',actor.userId):query.is('user_id',null).eq('guest_hash',actor.guestHash)
  const {data,error}=await query.abortSignal(AbortSignal.timeout(8000)).maybeSingle()
  if(error) dbError(error)
  if(!data) throw new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。')
  if(Date.parse(data.expires_at)<=Date.now()) throw new DiscoveryError('SEARCH_EXPIRED',410,'搜索已过期，请刷新结果。')
  return {...data,spec:discoverySpecSchema.parse(data.spec)} as Run
}

export async function readViewedDiscoveryProducts(actor:DiscoveryActor,run:Run,ids:string[]) {
  const {data,error}=await createServiceRoleClient().rpc('read_consumer_discovery_execution',{
    p_run_id:run.id,p_user_id:actor.userId,p_guest_hash:actor.guestHash,p_session_id:actor.sessionId,p_version:run.context_version,
  }).abortSignal(AbortSignal.timeout(8000))
  if(error)dbError(error)
  if(!data)throw new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。')
  const execution=(data as DbPage).execution
  const allowed=new Set(execution.candidateKeys)
  if(ids.length!==DISCOVERY_INSIGHT_SAMPLE_SIZE || new Set(ids).size!==ids.length || ids.some((id)=>!allowed.has(id)))throw new DiscoveryError('INVALID_VIEWED_PRODUCTS',400,'浏览记录无效。')
  const snapshot=await readPublishedConsumerCatalog()
  if(snapshot.version!==execution.catalogVersion)throw new DiscoveryError('SEARCH_EXPIRED',410,'目录已更新，请刷新结果。')
  return selectCatalogProducts(snapshot.products,ids)
}
