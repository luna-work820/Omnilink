import { load } from 'cheerio'
import type { ProductComposition } from '@/components/consumer-market/types'
import { normalizeCompositionName } from './product-composition'

/**
 * Conservative extraction of composition facts that are actually printed on a page.
 *
 * Automatic extraction never marks a record `verified`: an item list only becomes
 * verified after a human or a checked backfill script confirms the page, variant and
 * raw text. The raw text is always retained so every item can be checked against it.
 */

const MAX_ITEMS = 500
const INLINE_LABEL = /^(?:all ingredients|ingredients?|composition|material|面料|纤维成分|里料|成分表|全成分)\s*[:：]\s*(.+)$/i
const STANDALONE_LABEL = /^(?:all ingredients|ingredients?|composition|material|面料|纤维成分|成分表|全成分)\s*[:：]?\s*$/i
const PART_LABEL = /(?:\d+\s*)?(fabric|lining|petticoat|detail|shell|fill|padding|material|面料|里料|填充物|装饰)\s*[:：]\s*/gi
const FIBER_RATIO = /^(\d+(?:\.\d+)?\s*%)\s*(.+)$/

type Candidate = { label: string; text: string }

function clean(value: string, max = 8000) {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

function cleanPreservingLines(value: string, max = 8000) {
  return value.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max)
}

function addCandidate(candidates: Candidate[], label: string, text: string) {
  const value = cleanPreservingLines(text)
  if (value) candidates.push({ label, text: value })
}

function structuredCandidates(html: string): Candidate[] {
  const $ = load(html)
  const candidates: Candidate[] = []
  $('script[type="application/ld+json"]').each((_, element) => {
    let document: unknown
    try { document = JSON.parse($(element).html() || 'null') } catch { return }
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return
      if (Array.isArray(node)) { node.forEach(walk); return }
      const properties = (node as Record<string, unknown>)['additionalProperty']
      if (Array.isArray(properties)) {
        for (const property of properties) {
          const entry = property as Record<string, unknown>
          const name = typeof entry.name === 'string' ? entry.name : ''
          const value = typeof entry.value === 'string' ? entry.value : ''
          if (/^(composition|material|ingredients?|成分|面料)$/i.test(name)) addCandidate(candidates, name, value)
        }
      }
      Object.values(node as Record<string, unknown>).forEach(walk)
    }
    walk(document)
  })
  return candidates
}

function visibleCandidates(html: string): Candidate[] {
  const $ = load(html)
  $('script,style,noscript').remove()
  const candidates: Candidate[] = []
  $('li,p,div,span,dt,dd,th,td,h2,h3,h4').each((_, element) => {
    const own = $(element).clone().children().remove().end().text().replace(/\s+/g, ' ').trim()
    const inline = INLINE_LABEL.exec(own)
    if (inline) {
      addCandidate(candidates, inline[0].replace(/\s*[:：].*$/, ''), inline[1])
      return
    }
    if (!STANDALONE_LABEL.test(own)) return
    const next = $(element).next()
    if (next.is('ul,ol')) addCandidate(candidates, own, next.find('li').map((__, item) => clean($(item).text())).get().join(', '))
    else addCandidate(candidates, own, next.text())
  })
  return candidates
}

function pushItem(items: ProductComposition['items'], raw: string, sourceLabel: string, cosmetic: boolean) {
  const text = clean(raw)
  if (!text || items.length >= MAX_ITEMS) return
  const ratio = cosmetic ? null : FIBER_RATIO.exec(text)
  const name = ratio ? clean(ratio[2]) : text
  if (!name || name.length > 300) return
  items.push({ name, normalizedName: normalizeCompositionName(name), position: items.length + 1,
    sourceLabel, ...(ratio ? { proportion: ratio[1].replace(/\s+/g, '') } : {}) })
}

function itemsFromText(candidates: Candidate[], cosmetic: boolean) {
  const items: ProductComposition['items'] = []
  for (const candidate of candidates.slice(0, 4)) {
    if (cosmetic) {
      for (const line of candidate.text.split(/\r?\n|[,，;；、]+/)) pushItem(items, line, candidate.label, true)
      continue
    }
    const segments: Array<{ label: string; text: string }> = []
    let last = 0
    let label = candidate.label
    PART_LABEL.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = PART_LABEL.exec(candidate.text))) {
      if (match.index > last) segments.push({ label, text: candidate.text.slice(last, match.index) })
      label = clean(match[1])
      last = match.index + match[0].length
    }
    segments.push({ label, text: candidate.text.slice(last) })
    for (const segment of segments) {
      for (const part of segment.text.split(/\r?\n|[,，;；]+/)) pushItem(items, part, segment.label, false)
    }
  }
  return items
}

/** Returns null when no attributable printed composition could be found. */
export function extractCompositionFromHtml(html: string, sourceUrl: string, capturedAt: string, category = ''): ProductComposition | null {
  const candidates = [...structuredCandidates(html), ...visibleCandidates(html)]
  if (!candidates.length) return null
  const cosmetic = /个护|美妆|护肤|洗护|化妆品|香水|cosmetic|beauty|shampoo|conditioner|serum/i.test(category)
    || candidates.some((candidate) => /ingredients?|全成分|成分表/i.test(candidate.label))
  const items = itemsFromText(candidates, cosmetic)
  if (!items.length) return null
  return {
    kind: cosmetic ? 'cosmetic-inci' : /面料|fabric|lining|纤维|%/.test(candidates.map((candidate) => candidate.text).join(' ')) ? 'textile-fiber' : 'material',
    status: 'partial',
    items,
    rawText: candidates.map((candidate) => `${candidate.label}: ${candidate.text}`).join('\n').slice(0, 20000),
    sourceUrl,
    observedAt: capturedAt,
  }
}
