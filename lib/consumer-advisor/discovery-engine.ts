import 'server-only'
import { createHash,createHmac,randomBytes,randomUUID,timingSafeEqual } from 'node:crypto'
import type { NextRequest,NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { mapStorefrontDiscoveryRows } from '@/lib/storefront/service'
import type { Database } from '@/lib/database.types'
import { toConsumerProduct } from './consumer-product'
import { DiscoveryError,discoveryQuestion,discoverySpecSchema,type DiscoveryPage,type DiscoverySpec } from './discovery-contract'
import { loadPersonalContext,resolvePersonalContext,type PersonalContextSnapshot } from './personal-context'

const GUEST_COOKIE='omnilink_discovery_guest'
export type DiscoveryActor={userId:string|null;guestHash:string|null;sessionId:string;newGuestToken?:string}
type Run={id:string;spec:DiscoverySpec;user_id:string|null;guest_hash:string|null;session_id:string;context_version:number;expires_at:string}
type DbPage={id:string;spec:DiscoverySpec;sessionId:string;contextVersion:number;expiresAt:string;candidateCount:number;
  nextOffset:number|null;rows:Database['public']['Views']['discovery_products']['Row'][]}
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

export async function startDiscovery(actor:DiscoveryActor,input:DiscoverySpec,snapshot?:PersonalContextSnapshot):Promise<DiscoveryPage> {
  const spec=discoverySpecSchema.parse(input)
  const context=resolvePersonalContext(snapshot ?? await loadPersonalContext(actor.userId),spec)
  const client=createServiceRoleClient()
  const candidates=await client.rpc('search_consumer_discovery_candidates',{
    p_spec:spec,p_positive_terms:context.positiveTerms,p_avoid_terms:context.avoidTerms,
  }).abortSignal(AbortSignal.timeout(8000))
  if(candidates.error) dbError(candidates.error)
  const ids=[...new Set((candidates.data as {id:string}[] ?? []).map((row) => row.id))].slice(0,1000)
  const run={id:randomUUID(),user_id:actor.userId,guest_hash:actor.guestHash,session_id:actor.sessionId,spec,
    candidate_ids:ids,context_version:context.version,expires_at:new Date(Date.now()+15*60_000).toISOString()}
  const created=await client.rpc('create_consumer_discovery_run',{p_record:run}).abortSignal(AbortSignal.timeout(8000))
  if(created.error) dbError(created.error)
  return readDiscoveryPage(actor,{r:run.id,s:actor.sessionId,o:0,v:context.version,e:Date.parse(run.expires_at)})
}

async function readDiscoveryPage(actor:DiscoveryActor,cursor:z.infer<typeof cursorSchema>):Promise<DiscoveryPage> {
  if(cursor.s!==actor.sessionId) throw new DiscoveryError('SEARCH_NOT_FOUND',404,'找不到这次搜索。')
  const {data,error}=await createServiceRoleClient().rpc('page_consumer_discovery_run',{
    p_run_id:cursor.r,p_user_id:actor.userId,p_guest_hash:actor.guestHash,p_session_id:actor.sessionId,p_offset:cursor.o,p_version:cursor.v,
  }).abortSignal(AbortSignal.timeout(8000))
  if(error) dbError(error)
  if(!data) throw new DiscoveryError('CATALOG_UNAVAILABLE',503,'商品暂时无法读取，请重试。')
  const page=data as DbPage
  const spec=discoverySpecSchema.parse(page.spec)
  const products=mapStorefrontDiscoveryRows(page.rows).map(toConsumerProduct)
  return {searchRunId:page.id,sessionId:page.sessionId,query:spec.query,products,
    nextCursor:page.nextOffset===null?null:encodeDiscoveryCursor({r:page.id,s:actor.sessionId,o:page.nextOffset,v:Number(page.contextVersion),e:Date.parse(page.expiresAt)}),
    contextVersion:Number(page.contextVersion),snapshotVersion:1,pageSize:20,returnedCount:products.length,candidateCount:page.candidateCount,
    question:discoveryQuestion(spec),spec}
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
