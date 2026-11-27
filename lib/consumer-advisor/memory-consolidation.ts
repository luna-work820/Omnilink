import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { extractMemoryDeclaration } from './memory-lifecycle'
import { selectedAppearanceAction } from './appearance-actions'

export async function proposeMessageMemory(userId: string, messageId: string, content: string, skinAnswer = false, previousUserMessageId?: string) {
  const action = selectedAppearanceAction(content)
  const declaration = action && content.startsWith(`${action.prompt}\n`) ? content.slice(action.prompt.length + 1).trim() : content
  const candidate = extractMemoryDeclaration(declaration, { skinAnswer })
  if (!candidate) return false
  candidate.evidence = content
  const db = createServiceRoleClient()
  const { data, error } = await db.rpc('consolidate_consumer_memory', {
    p_user_id: userId, p_message_id: messageId, p_candidate: candidate,
  })
  if (error) throw new Error('记忆整理失败。')
  if (skinAnswer && previousUserMessageId && candidate.domain === 'skin') {
    const merged = await db.rpc('propose_consumer_skin_merge', {
      p_user_id: userId, p_first: previousUserMessageId, p_second: messageId,
    })
    if (merged.error) throw new Error('跨轮记忆整理失败。')
    return data?.status === 'proposed' || merged.data?.status === 'proposed'
  }
  return data?.status === 'proposed'
}

export async function consolidateRecentMemories(userId: string) {
  const db = createServiceRoleClient()
  const { data, error } = await db.from('consumer_AI assistant_messages')
    .select('id, content').eq('user_id', userId).eq('role', 'user')
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(12)
  if (error) throw new Error('记忆来源读取失败。')
  // Each RPC records its source atomically, so retries and concurrent responses
  // cannot recreate a forgotten/rejected proposal from the same old message.
  for (const message of [...(data ?? [])].reverse()) {
    const candidate = extractMemoryDeclaration(message.content)
    if (!candidate) continue
    const result = await db.rpc('consolidate_consumer_memory', {
      p_user_id: userId, p_message_id: message.id, p_candidate: candidate,
    })
    if (result.error) throw new Error('记忆整理失败。')
  }
}
