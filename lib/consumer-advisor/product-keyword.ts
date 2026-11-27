import type { ProductItem } from '@/components/consumer-market/types'

/**
 * Shared, catalog-derived product keyword recognition.
 *
 * This module is intentionally free of server-only imports: the Discover page and
 * the assistant route must classify the same prompt the same way. Fixed word lists
 * are only aliases for facts that actually exist in the published catalog; a new
 * category, brand, store or model is recognised from the catalog fields themselves.
 */

export type ProductKeywordKind = 'category' | 'name' | 'brand' | 'store' | 'model' | 'phrase'
export type ProductKeywordSource = 'rule' | 'explicit' | 'model'

export type ProductKeywordMatch = {
  kind: ProductKeywordKind
  term: string
  aliases: string[]
  categoryTerm?: string
  modelTerms?: string[]
}

type CatalogKeywordIndex = {
  categories: Set<string>
  names: Map<string, string>
  stores: Map<string, string>
  brands: Map<string, string>
  models: Map<string, Set<string>>
  searchText: Map<string, string>
}

const BRAND_KEYS = /^(品牌|品牌参考|brand|manufacturer|maker|牌子)$/i
const MODEL_KEYS = /^(型号|款号|系列|model|series|sku|style|货号)$/i
const GENERIC_MODEL_WORDS = new Set([
  'the', 'and', 'for', 'with', 'camera', 'cameras', 'body', 'lens', 'lenses', 'bag', 'bags',
  'shoes', 'shoe', 'dress', 'dresses', 'shirt', 'shirts', 'chair', 'table', 'sofa',
  'vintage', 'classic', 'silver', 'gold', 'black', 'white', 'mini', 'leather', 'cotton',
  'canvas', 'striped', 'polished', 'recycled', 'sterling', 'freshwater', 'high', 'new',
])

export function normalizeKeyword(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\u3000]+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim()
}

export function containsWholeTerm(text: string, normalizedTerm: string) {
  if (!normalizedTerm) return false
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return /[a-z0-9]/.test(normalizedTerm)
    ? new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(text)
    : text.includes(normalizedTerm)
}

/** A request that carries a question, a condition or a comparison is never a bare keyword. */
export function isComplexKeywordPrompt(prompt: string) {
  const text = prompt.normalize('NFKC').trim()
  if (/[?？！!]/.test(text)) return true
  if (/(怎么|如何|为什么|什么|哪些|哪个|区别|对比|比较|评测|测评|攻略|教程|文章|资料|资讯|新闻|文献|报告|适合|推荐|轻便|选购指南)/i.test(text)) return true
  if (/(不要|不含|除了|排除|别要|without|except|\bno\s+)/i.test(text)) return true
  if (/\d/.test(text) && /(元|美元|美金|欧元|块|USD|EUR|CNY|RMB|¥|\$|€|预算|以内|以下|以上|左右|under|budget|price|max)/i.test(text)) return true
  if (/(但|而且|并且| versus |\bvs\b|\band\b| 与 |，|,)/.test(text)) return true
  if (/(我|你|他|她|我们|你们)/.test(text) && !/^(请帮我|帮我|我想|想|请|给我)?(查找|搜索|检索|寻找|找|搜)(一下)?/.test(text)) return true
  // A colour plus a category is two conditions, not a bare keyword.
  if (/(黑色|白色|金色|银色|红色|蓝色|绿色|black|white|gold|silver|red|blue|green)/i.test(text)
    && normalizeKeyword(text).length > 2) return true
  return false
}

const SEARCH_PREFIX = /^(?:(?:请帮我|帮我|我想|想|请|给我)?(?:查找|搜索|检索|寻找|找|搜)(?:一下)?|(?:购买|选购|买))?(?:一件|一条|一双|一个|一些|一副|一套|一台|一本)?\s*/

export function stripSearchPrefix(prompt: string) {
  return prompt.trim().normalize('NFKC').replace(SEARCH_PREFIX, '').trim()
}

function normalizedFields(product: ProductItem) {
  return [product.name, product.category, product.storeName,
    ...Object.values(product.specs ?? {}).map((value) => String(value))]
    .filter(Boolean).map((value) => normalizeKeyword(value))
}

function addCandidate(map: Map<string, string>, key: string, productId: string) {
  if (key && !map.has(key)) map.set(key, productId)
}

/** Complete, normalized model facts for one product. Prefixes of a longer model are not facts. */
export function productModelFacts(product: ProductItem) {
  const values = Object.entries(product.specs ?? {}).filter(([key]) => MODEL_KEYS.test(key))
    .map(([, value]) => String(value))
  const matches = product.name.match(/\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z0-9][A-Za-z0-9]*){0,3}\b/g) ?? []
  for (const value of matches) {
    const words = value.split(/\s+/).filter((word) => !GENERIC_MODEL_WORDS.has(word.toLowerCase()))
    if (words.length && words.some((word) => /\d/.test(word))) values.push(words.join(' '))
  }
  return [...new Set(values.map((value) => normalizeKeyword(value)).filter((value) =>
    value.length >= 2 && value.length <= 40 && /\d|[a-z]/.test(value)))]
}

export function buildCatalogKeywordIndex(catalog: readonly ProductItem[]): CatalogKeywordIndex {
  const categories = new Set<string>(), names = new Map<string, string>(), stores = new Map<string, string>()
  const brands = new Map<string, string>(), models = new Map<string, Set<string>>(), searchText = new Map<string, string>()
  for (const product of catalog) {
    if (product.category) categories.add(normalizeKeyword(product.category))
    addCandidate(names, normalizeKeyword(product.name), product.id)
    addCandidate(stores, normalizeKeyword(product.storeName), product.id)
    for (const [key, value] of Object.entries(product.specs ?? {})) {
      if (BRAND_KEYS.test(key)) addCandidate(brands, normalizeKeyword(String(value)), product.id)
    }
    for (const candidate of productModelFacts(product)) {
      const owners = models.get(candidate) ?? new Set<string>()
      owners.add(product.id)
      models.set(candidate, owners)
    }
    searchText.set(product.id, normalizedFields(product).join(' '))
  }
  return { categories, names, stores, brands, models, searchText }
}

function aliasSupported(alias: string, index: CatalogKeywordIndex) {
  if (index.categories.has(alias)) return true
  for (const text of index.searchText.values()) if (containsWholeTerm(text, alias)) return true
  return false
}

/**
 * Recognise a bare product keyword. Alias groups come from existing search concepts,
 * but they only apply when at least one catalog product supports one of their terms.
 */
export function classifyProductKeyword(prompt: string, catalog: readonly ProductItem[],
  aliasGroups: readonly (readonly string[])[] = []): ProductKeywordMatch | null {
  const text = prompt.trim().normalize('NFKC')
  if (!text || text.length > 48 || isComplexKeywordPrompt(text)) return null
  const index = buildCatalogKeywordIndex(catalog)
  // With no catalog supplied (e.g. a spec built before retrieval), known aliases remain
  // usable as a fallback. Real requests always pass the published catalog.
  const aliasesWithoutCatalog = catalog.length === 0
  const terms = [...new Set([normalizeKeyword(text), normalizeKeyword(stripSearchPrefix(text))].filter(Boolean))]
  for (const term of terms) {
    // A model term is an exact catalog fact. Hard filtering uses complete model facts,
    // so a longer model (e.g. "R5 Mark II") cannot be pulled in by the prefix "R5".
    if (index.models.has(term)) return { kind: 'model', term, aliases: [term], modelTerms: [term] }
    if (index.names.has(term)) return { kind: 'name', term, aliases: [term] }
    if (index.stores.has(term)) return { kind: 'store', term, aliases: [term] }
    if (index.brands.has(term)) return { kind: 'brand', term, aliases: [term] }
    if (index.categories.has(term)) return { kind: 'category', term, aliases: [term], categoryTerm: term }
    const group = aliasGroups.find((words) => words.some((word) => normalizeKeyword(word) === term))
    if (group && (aliasesWithoutCatalog || group.some((word) => aliasSupported(normalizeKeyword(word), index)))) {
      const aliases = group.map((word) => normalizeKeyword(word)).slice(0, 5)
      return { kind: 'category', term, aliases, categoryTerm: term }
    }
    if (/^(?:[\p{Script=Han}]{1,12}|[a-z][a-z0-9' -]{0,39})$/iu.test(term)
      && [...index.searchText.values()].some((value) => containsWholeTerm(value, term))) {
      return { kind: 'phrase', term, aliases: [term] }
    }
  }
  return null
}
