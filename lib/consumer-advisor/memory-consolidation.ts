import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { extractMemoryDeclaration } from './memory-lifecycle'

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
