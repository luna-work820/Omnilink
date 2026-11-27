import { z } from 'zod'
import type { DiscoveryPage, DiscoveryQuestion } from './discovery-contract'

export type InformationItem = {
  id: string; entityType: 'product' | 'service' | 'content' | 'source'; title: string; excerpt: string;
  url: string; imageUrl: string | null; source: string; updatedAt: string; version: number;
}
export type ComparisonResult = {
  title: string; columns: { id: string; title: string; url: string }[];
  rows: { label: string; values: string[] }[]; sources: InformationItem[]; unknowns: string[];
  goal?:string;
}
export type FormQuestion = {
  id: string; label: string; type: 'single' | 'multiple' | 'text';
  options?: { value: string; label: string }[]; required?: boolean;
}
export type InteractiveForm = {
  id: string; title: string; questions: FormQuestion[];
  status: 'pending' | 'completed'; answers?: Record<string, string | string[]>;
}
export type ExecutionTask = {
  id: string; sessionId: string; status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  revision: number; attempt: number; completedSteps: string[]; error: string | null;
  result: ComparisonResult | null; updatedAt: string;
}
export type ResponseBlock =
  | { type: 'chat_message'; id: string; version: 1; data: { text: string } }
  | { type: 'discovery_feed'; id: string; version: 1; data: DiscoveryPage }
  | { type: 'information_feed'; id: string; version: 1; data: { query: string; items: InformationItem[] } }
  | { type: 'questionnaire'; id: string; version: 1; data: DiscoveryQuestion; state: 'pending' }
  | { type: 'interactive_form'; id: string; version: 1; data: InteractiveForm }
  | { type: 'comparison'; id: string; version: 1; data: ComparisonResult }
  | { type: 'task_progress'; id: string; version: 1; data: ExecutionTask }
  | { type: 'media_result'; id: string; version: 1; data: { url: string; alt: string } }

export type ConsumerResponse = {
  requestId: string; sessionId: string; conversationId: string; contractVersion: 1;
  status: 'partial' | 'completed' | 'failed' | 'cancelled'; blocks: ResponseBlock[]; text: string;
  error?: string; code?: string; [field: string]: unknown;
}
export type ResponseEvent =
  | { type: 'text_delta'; sequence: number; requestId: string; sessionId: string; delta: string }
  | { type: 'response'; sequence: number; requestId: string; sessionId: string; response: ConsumerResponse }
  | { type: 'error'; sequence: number; requestId: string; sessionId: string; error: string; code: string }

const href=z.string().max(2048).refine((value)=>value.startsWith('/')&&!value.startsWith('//')&&!/[\\\u0000-\u001f]/.test(value)||/^https:\/\//i.test(value))
const formQuestionSchema = z.object({id:z.string().min(1).max(80),label:z.string().min(1).max(240),type:z.enum(['single','multiple','text']),options:z.array(z.object({value:z.string().min(1).max(100),label:z.string().min(1).max(160)})).max(12).optional(),required:z.boolean().optional()})
const interactiveFormSchema = z.object({id:z.string().min(1).max(100),title:z.string().min(1).max(160),questions:z.array(formQuestionSchema).min(1).max(12),status:z.enum(['pending','completed']),answers:z.record(z.string(),z.union([z.string().max(2000),z.array(z.string().max(100)).max(12)])).optional()})
const itemSchema=z.object({id:z.string().max(100),entityType:z.enum(['product','service','content','source']),title:z.string().max(240),excerpt:z.string().max(6000),
  url:href,imageUrl:z.string().nullable(),source:z.string().max(240),updatedAt:z.string(),version:z.number().int().positive()})
const comparisonSchema=z.object({title:z.string().max(240),columns:z.array(z.object({id:z.string().max(100),title:z.string().max(240),url:href})).max(8),
  rows:z.array(z.object({label:z.string().max(80),values:z.array(z.string().max(1000)).max(8)})).max(12),sources:z.array(itemSchema).max(8),unknowns:z.array(z.string().max(240)).max(8),goal:z.string().max(1000).optional()})
const executionSchema=z.object({id:z.string().uuid(),sessionId:z.string().uuid(),status:z.enum(['pending','running','paused','completed','failed','cancelled']),revision:z.number().int().positive(),
  attempt:z.number().int().min(0).max(3),completedSteps:z.array(z.string().max(40)).max(4),error:z.string().nullable(),result:comparisonSchema.nullable(),updatedAt:z.string()})
export function readExecutionBlocks(value:unknown):ResponseBlock[] {
  if(!Array.isArray(value))return []
  return value.slice(0,12).flatMap((block)=>{
    if(!block||typeof block.id!=='string'||block.id.length>100||block.version!==1)return []
    const schema=block.type==='interactive_form'?interactiveFormSchema:block.type==='task_progress'?executionSchema:block.type==='comparison'?comparisonSchema:block.type==='information_feed'
      ?z.object({query:z.string().max(160),items:z.array(itemSchema).max(20)}):null
    const parsed=schema?.safeParse(block.data)
    return parsed?.success?[{type:block.type,id:block.id,version:1,data:parsed.data} as ResponseBlock]:[]
  })
}
export function readSourceIds(value:unknown):string[] {
  if(!Array.isArray(value))return []
  return value.slice(0,12).flatMap((block)=>block?.type==='source_refs'&&Array.isArray(block.data?.ids)
    ?block.data.ids.filter((id:unknown):id is string=>typeof id==='string'&&z.string().uuid().safeParse(id).success).slice(0,6):[]).slice(0,6)
}

export const compareInputSchema = z.object({
  productIds: z.array(z.string().max(100).refine((id)=>z.string().uuid().safeParse(id).success||/^external-[a-z0-9-]+$/i.test(id),'商品标识无效。')).max(6).default([]),
  urls: z.array(z.string().url().max(2048)).max(2).default([]),
  goal:z.string().trim().max(1000).optional(),
  requestedFields:z.array(z.enum(['price','material','size','color','source','summary'])).max(6).optional(),
}).refine((value) => value.productIds.length + value.urls.length > 0, '请先选择商品或添加网址。')
export type CompareInput = z.infer<typeof compareInputSchema>

export function responseEnvelope(requestId: string, sessionId: string, data: Record<string, unknown>): ConsumerResponse {
  const text = typeof data.text === 'string' ? data.text : ''
  const blocks = Array.isArray(data.blocks) ? data.blocks as ResponseBlock[] : text
    ? [{ type: 'chat_message' as const, id: `reply_${requestId}`, version: 1 as const, data: { text } }] : []
  return { ...data, text, blocks, requestId, sessionId, conversationId: sessionId, contractVersion: 1,
    status: data.status === 'failed' || data.status === 'cancelled' || data.status === 'partial' ? data.status : 'completed' }
}
