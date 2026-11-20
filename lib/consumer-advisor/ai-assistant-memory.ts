import 'server-only'
import { isUsablePersonalMemory } from './memory-lifecycle'

import type { SupabaseClient } from '@supabase/supabase-js'
import { readAiAssistantProfile, type AiAssistantProfile } from './ai-assistant-profile'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

export type AiAssistantMemory = {
  id: string
  domain: 'clothing' | 'skin' | 'hair' | 'space' | 'other'
  text: string
  origin: 'user' | 'inferred'
  status: 'proposed' | 'active' | 'rejected'
  evidence: string | null
  sourceMessageId: string | null
  supportIds: string[]
  confirmedAt: string | null
  revision: number
  supersedeIds: string[]
  sourceKind?: 'manual' | 'chat' | 'assessment' | 'legacy'
  sourcePayload?: Record<string, unknown>
  originalText?: string
}

export async function loadAiAssistantMemories(client: SupabaseClient, userId: string): Promise<AiAssistantMemory[]> {
  const { data, error } = await client.from('consumer_AI assistant_memories')
    .select('id, domain, text, origin, status, evidence, source_message_id, support_ids, confirmed_at, revision, supersede_ids, source_kind, source_payload, original_text')
    .neq('status', 'rejected')
    .eq('user_id', userId).order('updated_at', { ascending: false }).limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: {
    id: string; domain: AiAssistantMemory['domain']; text: string; origin: AiAssistantMemory['origin'];
    status: AiAssistantMemory['status']; evidence: string | null; source_message_id: string | null;
    support_ids: string[]; confirmed_at: string | null; revision: number; supersede_ids: string[];
    source_kind: AiAssistantMemory['sourceKind']; source_payload: Record<string, unknown>; original_text: string;
  }) => ({
    id: row.id, domain: row.domain, text: row.text, origin: row.origin,
    status: row.status, evidence: row.evidence, sourceMessageId: row.source_message_id, supportIds: row.support_ids ?? [],
    confirmedAt: row.confirmed_at, revision: row.revision, supersedeIds: row.supersede_ids ?? [],
    sourceKind: row.source_kind, sourcePayload: row.source_payload ?? {}, originalText: row.original_text,
  }))
}

export async function manageAiAssistantMemory(
  userId: string,
  action: 'manual' | 'propose' | 'confirm' | 'correct' | 'reject' | 'forget',
  input: Record<string, unknown>,
) {
  // Only server routes that verified identity may call this service-only RPC.
  const { data, error } = await createServiceRoleClient().rpc('manage_consumer_memory', {
    p_user_id: userId, p_action: action, p_input: input,
  })
  if (error) throw Object.assign(new Error('记忆更新失败。'), { code: error.code })
  return data as Record<string, unknown>
}

export function profileWithAiAssistantMemories(profile: unknown, memories: AiAssistantMemory[]): AiAssistantProfile {
  return { ...readAiAssistantProfile(profile), memories }
}

export function memoryContext(memories: AiAssistantMemory[]): string {
  return memories.filter((memory) => isUsablePersonalMemory(memory)).map((memory) =>
    `- ID ${memory.id}；${memory.origin === 'user' ? '用户自述' : '用户已确认的推断'}；${memory.domain}；${memory.text}`,
  ).join('\n') || '无'
}
