/**
 * data.mjs —— 数据访问层。
 *
 * 只做三件事：
 *   1. 从 Supabase 读 Catalog 商品与结构化属性
 *   2. 给每条数据打上 provenance（来源、归属、许可、调用时间）
 *   3. 把每一次调用写进调用账本（JSONL，分润的第一行）
 *
 * 与 Catalog 数据模型保持一致，不另发明一套 ontology。
 */

import { createClient } from '@supabase/supabase-js'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const ROOT = dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: join(ROOT, '..', '.env.local') })
dotenv.config({ path: join(ROOT, '.env') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
// service role 优先：可跨商家读到全量 canonical；退回 anon 时受 RLS 作用域限制。
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    '[omnilink-mcp] 缺少 Supabase 凭据。请在 Omnilink/.env.local 中配置 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（或 NEXT_PUBLIC_SUPABASE_ANON_KEY）。'
  )
}

export const supabase = createClient(SUPABASE_URL ?? '', SUPABASE_KEY ?? '', {
  auth: { persistSession: false },
})

/**
 * Catalog 白名单 select。属性来自 details，变体和媒体来自关联表。
 */
const PRODUCT_SELECT = [
  'id',
  'title',
  'description',
  'details',
  'organization_id',
  'catalog_variants!catalog_variants_item_organization_fkey(sku_code,title,price,currency_code,availability_type,availability_value)',
  'catalog_media!catalog_media_item_organization_fkey(storage_path,media_role,media_type)',
  'organizations(stores(name,slug,currency))',
].join(', ')

/* ---------------- semantic_data 拍平（JS 版 normalize） ---------------- */

function flattenSemanticData(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value)
    }
  }
  return out
}

function extractAttributes(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null
  const obj = input
  const target =
    obj.attributes && typeof obj.attributes === 'object' && !Array.isArray(obj.attributes)
      ? obj.attributes
      : obj
  const unwrapped = {}
  for (const [key, value] of Object.entries(target)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
      unwrapped[key] = value.value
    } else {
      unwrapped[key] = value
    }
  }
  const flat = flattenSemanticData(unwrapped)
  return Object.keys(flat).length > 0 ? flat : null
}

/** Catalog 属性优先级：details.attributes → details.semantic_data → 空对象。 */
export function resolveCanonical(row) {
  const details = row.details && typeof row.details === 'object' ? row.details : {}
  const attrs = extractAttributes(details.attributes ?? details.semantic_data)
  if (attrs) {
    return { attributes: attrs, source: 'catalog_items.details', meta: null }
  }
  return { attributes: {}, source: 'none', meta: null }
}

/* ---------------- provenance ---------------- */

const LICENSE = 'agent-readable; attribution-required; no-training-without-consent'

function buildProvenance(row, canonical) {
  const organizations = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
  const stores = organizations?.stores
  const store = Array.isArray(stores) ? stores[0] : stores
  const storeName = store?.name ?? null
  return {
    source_layer: 'Omnilink canonical (Identity + Data + Semantic Graph)',
    canonical_source: canonical.source,
    data_subject: storeName,
    store_slug: store?.slug ?? null,
    product_id: row.id,
    semantic_confidence: canonical.meta?.confidence ?? null,
    semantic_generated_by: canonical.meta?.generated_by ?? null,
    semantic_updated_at: canonical.meta?.updated_at ?? null,
    retrieved_at: new Date().toISOString(),
    license: LICENSE,
    attribution: storeName
      ? `数据主体：${storeName}；经 Omnilink 结构化。调用须署名，商用与训练需另行授权。`
      : '数据主体未标注；经 Omnilink 结构化。调用须署名。',
  }
}

/* ---------------- 调用账本 ---------------- */

const LOG_DIR = join(ROOT, 'logs')
const LOG_FILE = join(LOG_DIR, 'calls.jsonl')

/**
 * 每一次 agent 调用写一行。这是"被调用即记账"的最小形态，
 * 未来接 C4 登记处 / 分润结算时，这一行就是账目原凭证。
 */
export function logCall(entry) {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n')
  } catch {
    // 账本写失败不应阻断调用
  }
}

/* ---------------- 对外数据方法 ---------------- */

function toCard(row) {
  const canonical = resolveCanonical(row)
  const organizations = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
  const stores = organizations?.stores
  const store = Array.isArray(stores) ? stores[0] : stores
  const variant = Array.isArray(row.catalog_variants) ? row.catalog_variants[0] : row.catalog_variants
  return {
    id: row.id,
    name: row.title ?? 'Untitled product',
    price: Number(variant?.price ?? 0),
    currency: variant?.currency_code ?? store?.currency ?? 'USD',
    description: row.description ?? null,
    store: store?.name ?? null,
    store_slug: store?.slug ?? null,
    image: pickImage(row.catalog_media),
    attributes: canonical.attributes,
    provenance: buildProvenance(row, canonical),
  }
}

function pickImage(assets) {
  if (!Array.isArray(assets) || assets.length === 0) return null
  const preferred = ['public', 'processed', 'watermark', 'transparent']
  const hit =
    assets.find((a) => a?.storage_path && preferred.includes(a.media_role ?? '')) ??
    assets.find((a) => a?.storage_path)
  return hit?.storage_path ?? null
}

/**
 * 关键词检索。一天版不引入向量检索：
 * 拉回有限集合后在本地按 name / description / attributes 打分排序，
 * 好处是中文与属性词都能命中，且不依赖数据库全文索引配置。
 */
export async function searchProducts({ query, storeSlug, limit = 8 }) {
  const cap = 200
  const q = supabase.from('catalog_items').select(PRODUCT_SELECT).eq('status', 'active').limit(cap)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const needle = (query ?? '').trim().toLowerCase()

  const scored = rows
    .map(toCard)
    .filter((card) => !storeSlug || card.store_slug === storeSlug)
    .map((card) => {
      if (!needle) return { card, score: 0 }
      const haystack = [
        card.name,
        card.description ?? '',
        Object.values(card.attributes).join(' '),
        card.store ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return null
      const score =
        (card.name.toLowerCase().includes(needle) ? 3 : 0) +
        (Object.values(card.attributes).join(' ').toLowerCase().includes(needle) ? 2 : 0) +
        ((card.description ?? '').toLowerCase().includes(needle) ? 1 : 0)
      return { card, score }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  const results = (needle ? scored : scored).slice(0, limit).map((s) => s.card)
  return { count: results.length, scanned: rows.length, results }
}

export async function getProduct({ productId }) {
  const { data, error } = await supabase
    .from('catalog_items')
    .select(PRODUCT_SELECT)
    .eq('id', productId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return toCard(data)
}

/**
 * 字段级对齐对比。
 * 注意边界：这是"同一性解析"的种子，不是跨商家实体解析——
 * 它只对齐同一批候选的字段，不判断两个 listing 是否同一件商品。
 */
export async function compareProducts({ productIds }) {
  const cards = []
  for (const id of productIds) {
    const card = await getProduct({ productId: id })
    if (card) cards.push(card)
  }
  if (cards.length === 0) return { error: 'no_products_found', productIds }

  const keySets = cards.map((c) => new Set([...Object.keys(c.attributes), 'price']))
  const sharedKeys = [...keySets[0]].filter((k) => keySets.every((s) => s.has(k)))

  const rows = sharedKeys.map((key) => {
    const values = cards.map((c) => (key === 'price' ? `${c.price} ${c.currency}` : c.attributes[key] ?? null))
    return {
      field: key,
      values,
      identical: new Set(values.map((v) => String(v))).size === 1,
    }
  })

  return {
    products: cards.map((c) => ({
      id: c.id,
      name: c.name,
      store: c.store,
      price: `${c.price} ${c.currency}`,
      provenance: c.provenance,
    })),
    aligned_fields: rows,
    differing_fields: rows.filter((r) => !r.identical).map((r) => r.field),
    note: '字段级对齐，不等于跨商家实体同一性判定。',
  }
}
