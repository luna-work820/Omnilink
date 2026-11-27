import type { ProductComposition, ProductItem } from '@/components/consumer-market/types'

type CompositionSource = Pick<ProductItem, 'composition' | 'itemType' | 'deliveryType'> &
  Partial<Pick<ProductItem, 'category' | 'specs' | 'sourceUrl' | 'sourceDate'>>

const EMPTY_COMPOSITION: ProductComposition = {kind: 'unknown', status: 'not_provided', items: []}
const NOT_APPLICABLE_COMPOSITION: ProductComposition = {kind: 'unknown', status: 'not_applicable', items: []}
const COMPOSITION_KINDS: readonly ProductComposition['kind'][] = ['cosmetic-inci', 'textile-fiber', 'metal-alloy', 'material', 'other', 'unknown']
const COMPOSITION_STATUSES: readonly ProductComposition['status'][] = ['verified', 'partial', 'not_provided', 'not_applicable']

export function normalizeCompositionName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')
}

function normalizeComposition(value: ProductComposition): ProductComposition {
  const kind = COMPOSITION_KINDS.includes(value.kind) ? value.kind : 'unknown'
  const items = Array.isArray(value.items) ? value.items.flatMap((item, index) => {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) return []
    const name = item.name.trim()
    return [{
      name,
      normalizedName: normalizeCompositionName(name),
      position: Number.isInteger(item.position) && Number(item.position) > 0 ? Number(item.position) : index + 1,
      ...(typeof item.proportion === 'string' ? {proportion: item.proportion} : {}),
      ...(typeof item.purity === 'string' ? {purity: item.purity} : {}),
      ...(typeof item.role === 'string' ? {role: item.role} : {}),
      ...(typeof item.sourceLabel === 'string' ? {sourceLabel: item.sourceLabel} : {}),
    }]
  }) : []
  const providedStatus = COMPOSITION_STATUSES.includes(value.status) ? value.status : 'not_provided'
  const status = items.length > 0 && (providedStatus === 'not_provided' || providedStatus === 'not_applicable')
    ? 'partial'
    : providedStatus

  return {
    kind,
    status,
    items,
    ...(typeof value.rawText === 'string' ? {rawText: value.rawText} : {}),
    ...(typeof value.region === 'string' ? {region: value.region} : {}),
    ...(typeof value.sourceUrl === 'string' ? {sourceUrl: value.sourceUrl} : {}),
    ...(typeof value.observedAt === 'string' ? {observedAt: value.observedAt} : {}),
    ...(typeof value.verifiedAt === 'string' ? {verifiedAt: value.verifiedAt} : {}),
  }
}

function specPriority(label: string): number {
  if (/全成分|完整成分表|完整配方|\bINCI\b|full ingredients/i.test(label)) return 0
  if (/面料成分|纤维成分|材质成分/i.test(label)) return 1
  if (/主要成分|成分表|ingredient/i.test(label)) return 2
  if (/材质|材料|面料|纤维|金属|composition|material/i.test(label)) return 3
  return Number.POSITIVE_INFINITY
}

function kindFromFields(category: string | undefined, fields: Array<[string, string]>): ProductComposition['kind'] {
  const labels = fields.map(([label]) => label)
  const values = fields.map(([, value]) => value).join(' ')
  if (labels.some((label) => /面料|纤维/.test(label)) || /\b(?:wool|cotton|linen|silk|polyester)\b|羊毛|棉|亚麻|真丝|涤纶/i.test(values)) return 'textile-fiber'
  if (/个护|美妆|护肤|洗护|香水|cosmetic|beauty/i.test(category ?? '') ||
      labels.some((label) => /全成分|完整成分表|完整配方|\bINCI\b|主要成分|ingredient/i.test(label))) return 'cosmetic-inci'
  if (/\b925\b|sterling silver|纯银|足银/i.test(values)) return 'metal-alloy'
  return 'material'
}

function entriesFromSpecs(kind: ProductComposition['kind'], fields: Array<[string, string]>) {
  const entries = fields.flatMap(([sourceLabel, rawText]) => {
    const delimiter = kind === 'cosmetic-inci' ? /[,，;；、]+/ : /[,，;；、/]+/
    return rawText.split(delimiter).map((name) => name.trim()).filter(Boolean)
      .map((name) => ({name, sourceLabel}))
  })
  return entries.map((entry, index) => {
    const position = index + 1
    if (kind === 'textile-fiber') {
      const ratio = /^(\d+(?:\.\d+)?\s*%)\s*(.+)$/.exec(entry.name)
      if (ratio) return {...entry, name: ratio[2].trim(), proportion: ratio[1].replace(/\s+/g, ''), position}
    }
    if (kind === 'metal-alloy') {
      const purity = /\b(925|950|999)\b/.exec(entry.name)?.[1]
      if (purity) return {...entry, purity, position}
    }
    return {...entry, position}
  })
}

export function resolveProductComposition(product: CompositionSource): ProductComposition {
  if (product.composition) {
    const composition = normalizeComposition(product.composition)
    // Legacy scraped rows predate itemType/deliveryType. An unmarked item is still a
    // physical product for status correction; only explicit service/digital is excluded.
    const legacyPhysical = product.itemType === undefined && product.deliveryType === undefined
    if ((legacyPhysical || (product.itemType === 'product' && product.deliveryType === 'physical'))
      && composition.status === 'not_applicable'
      && composition.kind === 'unknown' && composition.items.length === 0
      && /洗护|护肤|精华|新中式|服饰|时尚|设计师|连衣裙|衣服|上衣|裙装/i.test(product.category ?? '')) {
      return {...composition, status: 'not_provided'}
    }
    return composition
  }
  if (product.itemType === 'service' || product.itemType === 'skill' || product.deliveryType === 'digital' ||
      product.deliveryType === 'ai_capability') return NOT_APPLICABLE_COMPOSITION

  const candidates = Object.entries(product.specs ?? {})
    .filter(([label, value]) => Number.isFinite(specPriority(label)) && value.trim())
    .sort(([a], [b]) => specPriority(a) - specPriority(b))
  const bestPriority = candidates.length ? specPriority(candidates[0][0]) : Number.POSITIVE_INFINITY
  const selected = candidates.filter(([label]) => specPriority(label) === bestPriority)
  if (!selected.length) return EMPTY_COMPOSITION

  const kind = kindFromFields(product.category, selected)
  const rawText = selected.map(([label, value]) => `${label}: ${value}`).join('\n')
  return {
    kind,
    status: 'partial',
    items: entriesFromSpecs(kind, selected),
    rawText,
    ...(product.sourceUrl ? {sourceUrl: product.sourceUrl} : {}),
    ...(product.sourceDate ? {observedAt: product.sourceDate} : {}),
  }
}

export function withProductComposition<T extends ProductItem>(product: T): T & {composition: ProductComposition} {
  return {...product, composition: resolveProductComposition(product)}
}
