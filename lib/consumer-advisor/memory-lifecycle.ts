import type { AiAssistantMemory } from './ai-assistant-memory'

export type MemoryLifecycle = {
  subject: 'self' | 'other'
  scope: 'long-term' | 'temporary'
  expiresAt: string | null
}

export function readMemoryLifecycle(value: unknown): MemoryLifecycle | null {
  if (value === undefined) return { subject: 'self', scope: 'long-term', expiresAt: null }
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (!['self', 'other'].includes(String(item.subject)) || !['long-term', 'temporary'].includes(String(item.scope))) return null
  if (item.expiresAt !== null && (typeof item.expiresAt !== 'string' || !Number.isFinite(Date.parse(item.expiresAt)))) return null
  if (item.scope === 'temporary' && item.expiresAt === null) return null
  return { subject: item.subject as MemoryLifecycle['subject'], scope: item.scope as MemoryLifecycle['scope'], expiresAt: item.expiresAt as string | null }
}

export function isUsablePersonalMemory(memory: AiAssistantMemory, now = Date.now()) {
  const lifecycle = readMemoryLifecycle(memory.sourcePayload?.lifecycle)
  return memory.status === 'active' && Boolean(memory.confirmedAt) && lifecycle !== null
    && lifecycle.subject === 'self' && (lifecycle.expiresAt === null || Date.parse(lifecycle.expiresAt) > now)
}

// Only standalone, first-person declarations become candidates. Questions, gifts,
// quotations and temporary situations remain in conversation history.
export function extractMemoryDeclaration(content: string) {
  const text = content.trim().replace(/^(?:请)?(?:你)?记住[：:，,\s]*/, '')
  if (text.length > 120 || /[?？\n“”"「」『』]|如果|假如|比如|例如|假设|可能|也许|不确定|这个|那个|这样|那样|这次|今天|最近|暂时|目前|这周|本周|这个月|送给|帮.*买|替.*买|朋友|家人|妈妈|爸爸|女友|男友/.test(text)) return null
  const match = /^我(?:一直|平时|通常)?(不喜欢|喜欢|偏好)([^，,。；;！!]{1,80})[。！!]?$/u.exec(text)
  if (!match) return null
  const term = match[2].trim()
  if (!term || /但是|不过|而且|以及|和|或者|不是|不再|不要|不喜欢/.test(term)) return null
  const domain: AiAssistantMemory['domain'] = /衣|穿搭|裙|裤|鞋|配饰/.test(term) ? 'clothing'
    : /护肤|皮肤|面霜|洁面/.test(term) ? 'skin'
      : /头发|发型|洗发|护发/.test(term) ? 'hair'
        : /家具|家居|空间|沙发|桌|椅|装修/.test(term) ? 'space' : 'other'
  const negative = match[1] === '不喜欢'
  return { text, domain, origin: 'user' as const, evidence: content,
    sourcePayload: { lifecycle: { subject: 'self', scope: 'long-term', expiresAt: null },
      factKey: term.toLowerCase().replace(/\s+/g, ''), polarity: negative ? 'negative' : 'positive',
      preferenceSignals: { positiveTerms: negative ? [] : [term], avoidTerms: negative ? [term] : [] } } }
}
