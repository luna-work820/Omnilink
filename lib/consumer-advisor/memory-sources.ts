import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiAssistantMemory } from './ai-assistant-memory'

export async function withMemorySources(client: SupabaseClient, userId: string, memories: AiAssistantMemory[]) {
  const ids = [...new Set(memories.flatMap((memory) => {
    if (memory.sourceKind !== 'chat') return []
    const observations = memory.sourcePayload?.observations
    return [memory.sourceMessageId, ...(Array.isArray(observations) ? observations : [])]
      .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100)
  }))].slice(0, 1000)
  if (!ids.length) return memories
  const { data, error } = await client.from('consumer_AI assistant_messages')
    .select('id,content,role,created_at').eq('user_id', userId).in('id', ids)
  if (error) throw new Error('记忆来源读取失败。')
  const sources = new Map((data ?? []).map((row: { id: string; content: string; role: string; created_at: string }) => [row.id, row]))
  return memories.map((memory) => {
    const observations = memory.sourcePayload?.observations
    const ownIds = [...new Set([memory.sourceMessageId, ...(Array.isArray(observations) ? observations : [])]
      .filter((id): id is string => typeof id === 'string'))]
    const sourceMessages = memory.sourceKind === 'chat' ? ownIds.flatMap((id) => {
      const source = sources.get(id)
      return source && (source.role === 'user' || (memory.origin === 'inferred' && source.role === 'assistant'))
        ? [{ id: source.id, content: source.content, role: source.role, createdAt: source.created_at }] : []
    }) : []
    return { ...memory, sourcePayload: { ...memory.sourcePayload, sourceMessages } }
  })
}
