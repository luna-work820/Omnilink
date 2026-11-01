import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { readEvaProfile, type EvaProfile } from './eva-onboarding'
import { isUuid } from '@/lib/utils/uuid'

type Db = SupabaseClient<any>

export type EvaMemory = {
  id: string
  domain: 'clothing' | 'skin' | 'hair' | 'space' | 'other'
  text: string
  origin: 'user' | 'inferred'
  status: 'active' | 'rejected'
  evidence: string | null
  sourceMessageId: string | null
  supportIds: string[]
}

export async function loadEvaMemories(client: SupabaseClient, userId: string, legacy: unknown): Promise<EvaMemory[]> {
  const db = client as Db
  const old = readEvaProfile(legacy).memories.filter((item) => isUuid(item.id) && item.text.trim().length > 0 && item.text.length <= 240)
  if (old.length) {
    const { error } = await db.from('consumer_eva_memories').upsert(old.map((item) => ({
      id: item.id, user_id: userId, domain: item.domain, text: item.text,
      origin: 'user', evidence: '你手动保存的记忆',
    })), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
    const { error: clearError } = await client.auth.updateUser({ data: { eva_profile: { ...readEvaProfile(legacy), memories: [] } } })
    if (clearError) throw new Error(clearError.message)
  }
  const { data, error } = await db.from('consumer_eva_memories')
    .select('id, domain, text, origin, status, evidence, source_message_id, support_ids')
    .eq('user_id', userId).order('updated_at', { ascending: false }).limit(50)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.id, domain: row.domain, text: row.text, origin: row.origin,
    status: row.status, evidence: row.evidence, sourceMessageId: row.source_message_id, supportIds: row.support_ids ?? [],
  }))
}

export function profileWithMemories(profile: unknown, memories: EvaMemory[]): EvaProfile {
  return { ...readEvaProfile(profile), memories }
}

export function memoryContext(memories: EvaMemory[]): string {
  return memories.filter((memory) => memory.status === 'active').map((memory) =>
    `- ID ${memory.id}；${memory.origin === 'user' ? '用户自述' : '待确认推测'}；${memory.domain}；${memory.text}`,
  ).join('\n') || '无'
}
