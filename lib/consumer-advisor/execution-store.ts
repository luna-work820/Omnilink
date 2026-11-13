import 'server-only'
import { createHash } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { DiscoveryActor } from './discovery-engine'
import type { CompareInput, ComparisonResult, ConsumerResponse, ExecutionTask, InformationItem } from './response-contract'
import { DiscoveryError } from './discovery-contract'

export type Actor = Pick<DiscoveryActor, 'userId' | 'guestHash' | 'sessionId'>
export type TaskRecord = {
  id: string; session_id: string; input: CompareInput; status: ExecutionTask['status']; checkpoints: Record<string, unknown>;
  revision: number; attempt: number; lease: string | null; claimed?: boolean; lease_until: string | null;
  error_code: string | null; result: ComparisonResult | null; updated_at: string;
}
export type RequestRecord = {
  request_id: string; token: string; created?: boolean; status: 'running' | 'completed' | 'failed' | 'cancelled';
  result: ConsumerResponse | null; http_status: number;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => [k,canonical(v)]))
  return value
}
export function requestFingerprint(value: unknown) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex') }

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createServiceRoleClient().rpc(name,args).abortSignal(AbortSignal.timeout(8000))
  if (error) {
    if (error.code === 'P0002') throw new DiscoveryError('NOT_FOUND',404,'找不到这项任务或请求。')
    if (error.code === '22000') throw new DiscoveryError('REQUEST_CONFLICT',409,'同一请求标识对应了不同内容。')
    if (error.code === '40001') throw new DiscoveryError('EXECUTION_CHANGED',409,'任务状态已更新，请重新读取。')
    if (/EXPIRED/.test(error.message)) throw new DiscoveryError('EXECUTION_EXPIRED',410,'记录已过期，请重新发起。')
    throw new DiscoveryError('EXECUTION_UNAVAILABLE',503,'任务记录暂时无法读取，请重试。')
  }
  return data as T
}
export const requestStore = (action: string, actor: Actor, input: Record<string, unknown>) =>
  rpc<RequestRecord>('manage_consumer_request',{p_action:action,p_actor:actor,p_input:input})
export const taskStore = (action: string, actor: Actor, input: Record<string, unknown>) =>
  rpc<TaskRecord>('manage_consumer_execution',{p_action:action,p_actor:actor,p_input:input})

export function taskView(record: TaskRecord): ExecutionTask {
  return { id:record.id,sessionId:record.session_id,status:record.status,revision:record.revision,attempt:record.attempt,
    completedSteps:Object.keys(record.checkpoints),error:record.error_code,result:record.result,updatedAt:record.updated_at }
}
export function informationItem(row: Record<string, unknown>): InformationItem {
  return { id:String(row.id),entityType:row.entity_type as InformationItem['entityType'],title:String(row.title),excerpt:String(row.excerpt ?? ''),
    url:String(row.url),imageUrl:typeof row.image_url==='string'?row.image_url:null,source:String(row.source ?? ''),updatedAt:String(row.updated_at ?? row.fetched_at),version:Number(row.version ?? 1) }
}
export async function searchInformation(actor: Actor, query: string, types: InformationItem['entityType'][] = ['product','service','content','source']) {
  const rows=await rpc<Record<string,unknown>[]>('search_consumer_information',{p_actor:actor,p_query:query.slice(0,160),p_types:types,p_limit:20})
  return rows.map(informationItem)
}
export async function readOwnedSources(actor:Actor,ids:string[]) {
  if(!ids.length)return []
  let query=createServiceRoleClient().from('consumer_external_sources').select('id,title,excerpt,url,version,fetched_at').in('id',ids.slice(0,6))
    .eq('session_id',actor.sessionId).gt('expires_at',new Date().toISOString())
  query=actor.userId?query.eq('user_id',actor.userId):query.is('user_id',null).eq('guest_hash',actor.guestHash)
  const {data,error}=await query.abortSignal(AbortSignal.timeout(8000))
  if(error)throw new DiscoveryError('SOURCE_UNAVAILABLE',503,'资料暂时无法读取。')
  return (data??[]).map((row)=>informationItem({...row,entity_type:'source',source:new URL(row.url).hostname}))
}
export async function saveExternalSource(actor: Actor, source: { url:string;title:string;excerpt:string },task:{id:string;lease:string|null}) {
  const row=await rpc<Record<string,unknown>>('save_consumer_external_source',{p_actor:actor,p_source:{...source,
    urlHash:requestFingerprint(source.url),contentHash:requestFingerprint([source.title,source.excerpt]),taskId:task.id,lease:task.lease}})
  return informationItem({...row,entity_type:'source',image_url:null,source:new URL(source.url).hostname})
}
