import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { AiAssistantMemory } from './ai-assistant-memory'
import { DiscoveryError, type DiscoverySpec } from './discovery-contract'

export type PersonalContextSnapshot = { userId: string | null; version: number; memories: AiAssistantMemory[] }
export type ResolvedPersonalContext = PersonalContextSnapshot & {
  cacheKey: string; positiveTerms: string[]; avoidTerms: string[]; usedMemoryIds: string[]
}

export async function loadPersonalContext(userId: string | null): Promise<PersonalContextSnapshot> {
  if (!userId) return { userId: null, version: 0, memories: [] }
  const { data, error } = await createServiceRoleClient().rpc('get_consumer_context_snapshot', { p_user_id: userId }).abortSignal(AbortSignal.timeout(8000))
  if (error || !data) throw new DiscoveryError('CONTEXT_UNAVAILABLE', 503, '个人偏好暂时无法读取，请重试。')
  const snapshot = data as { version: number; memories: AiAssistantMemory[] }
  return { userId, version: Number(snapshot.version), memories: snapshot.memories.filter((m) => m.status === 'active' && m.confirmedAt) }
}

const facets = ['简约','简洁','复古','原木','木质','金属','皮质','布艺','棉','羊毛','银色','金色','黑色','白色','红色','蓝色','绿色',
  'minimal','vintage','retro','wood','cotton','linen','wool','silver','gold','black','white','red','blue','green']
function termsFromMemory(memory: AiAssistantMemory) {
  const positive: string[] = [], negative: string[] = []
  const signals = memory.sourcePayload?.preferenceSignals as { positiveTerms?: unknown; avoidTerms?: unknown } | undefined
  if (signals) {
    for (const [source, target] of [[signals.positiveTerms, positive], [signals.avoidTerms, negative]] as const) {
      if (Array.isArray(source)) target.push(...source.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= 48))
    }
  }
  for (const clause of memory.text.toLowerCase().split(/[，,。；;\n]/)) {
    const negativeClause = /不喜欢|不要|避免|讨厌|不想|不适合|avoid|dislike|not\b/.test(clause)
    const terms = facets.filter((term) => clause.includes(term))
    ;(negativeClause ? negative : positive).push(...terms)
  }
  return { positive, negative }
}

export function resolvePersonalContext(snapshot: PersonalContextSnapshot, spec?: DiscoverySpec): ResolvedPersonalContext {
  const confirmed = snapshot.memories.filter((m) => m.status === 'active' && m.confirmedAt)
  const positive = new Set<string>(), negative = new Set<string>(), usedMemoryIds: string[] = []
  for (const memory of confirmed) {
    const terms = termsFromMemory(memory)
    if (!terms.positive.length && !terms.negative.length) continue
    for (const term of terms.positive) positive.add(term)
    for (const term of terms.negative) negative.add(term)
    usedMemoryIds.push(memory.id)
  }
  // The current query controls eligibility; confirmed preferences only change order.
  for (const term of spec?.excludedTerms ?? []) positive.delete(term)
  for (const term of negative) positive.delete(term)
  return { ...snapshot, memories: confirmed, cacheKey: `${snapshot.userId ?? 'guest'}:${snapshot.version}`,
    positiveTerms: [...positive].slice(0, 24), avoidTerms: [...negative].slice(0, 24), usedMemoryIds: usedMemoryIds.slice(0, 6) }
}
