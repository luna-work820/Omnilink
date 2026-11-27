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

export function isSkinSelfReportPrompt(content: string) {
  return /肤质|出油|皮肤|肌肤|T区|脸颊/i.test(content)
    && /你|您|请|告诉我|说说|[?？]/.test(content)
}

function canonicalPreference(term: string) {
  const normalized = term.toLowerCase().replace(/\s+/g, '')
  const equivalents: Record<string, string> = {
    新中式穿搭: '新中式服装', 新中式衣服: '新中式服装', 新中式服饰: '新中式服装',
    中式穿搭: '中式服装', 中式衣服: '中式服装', 中式服饰: '中式服装',
  }
  return equivalents[normalized] ?? normalized
}

// Only standalone, first-person declarations become candidates. Questions, gifts,
// quotations and temporary situations remain in conversation history.
export function extractMemoryDeclaration(content: string, options: { skinAnswer?: boolean } = {}) {
  const text = content.trim().replace(/^(?:请)?(?:你)?记住[：:，,\s]*/, '')
  if (text.length > 120 || /[?？\n“”"「」『』]|如果|假如|比如|例如|假设|可能|也许|不确定|这个|那个|这样|那样|这次|今天|最近|暂时|目前|这周|本周|这个月|下周|下个月|明天|今年|夏天|冬天|送给|帮.*买|替.*买|朋友|家人|妈妈|爸爸|女友|男友/.test(text)) return null
  const skin = /^(?:我(?:的)?|我的皮肤|我属于|我是)(?:皮肤|肤质|肌肤|肌)?(?:平时|通常|比较|容易|偏)?(?:T区|鼻子|鼻翼|脸颊|下巴|全脸|混合性?|油性|干性|中性|敏感性?)(?:比较|容易|偏|会)?(?:出油|油|干燥|干|敏感|皮肤|肤质|肌|肌肤)?[。！!]?$/iu.test(text)
    || /^我(?:的)?(?:皮肤|肌肤)(?:平时|通常|比较|容易|偏)?(?:出油|油|干燥|干|敏感)[。！!]?$/u.test(text)
    || (options.skinAnswer && /^(?:T区|鼻子|鼻翼|脸颊|下巴|全脸)(?:平时|比较|容易|偏)?(?:出油|油|干燥|干)[。！!]?$/iu.test(text))
  const skinRegion = text.match(/T区|鼻翼|鼻子|脸颊|下巴|全脸/i)?.[0].toLowerCase()
  const skinCondition = /出油|油$|油[。！!]$/.test(text) ? 'positive' : /干燥|干$|干[。！!]$/.test(text) ? 'negative' : null
  if (skin) return { text, domain: 'skin' as const, origin: 'user' as const, evidence: content,
    sourcePayload: { lifecycle: { subject: 'self', scope: 'long-term', expiresAt: null },
      factKey: skinRegion && skinCondition ? `skin:moisture:${skinRegion}` : `skin:${text.toLowerCase().replace(/\s+/g, '')}`, polarity: skinCondition ?? 'positive',
      preferenceSignals: { positiveTerms: [], avoidTerms: [] } } }
  const match = /^我(?:一直|平时|通常|比较|更)?(不喜欢|喜欢|偏好)([^，,。；;！!]{1,80})[。！!]?$/u.exec(text)
  if (!match) return null
  const term = match[2].trim()
  if (!term || /但是|不过|而且|以及|和|或者|不是|不再|不要|不喜欢/.test(term)) return null
  const domain: AiAssistantMemory['domain'] = /衣|服装|服饰|穿搭|裙|裤|鞋|配饰/.test(term) ? 'clothing'
    : /护肤|皮肤|面霜|洁面/.test(term) ? 'skin'
      : /头发|发型|洗发|护发/.test(term) ? 'hair'
        : /家具|家居|空间|沙发|桌|椅|装修/.test(term) ? 'space' : 'other'
  const negative = match[1] === '不喜欢'
  return { text, domain, origin: 'user' as const, evidence: content,
    sourcePayload: { lifecycle: { subject: 'self', scope: 'long-term', expiresAt: null },
      factKey: canonicalPreference(term), polarity: negative ? 'negative' : 'positive',
      preferenceSignals: { positiveTerms: negative ? [] : [term], avoidTerms: negative ? [term] : [] } } }
}
