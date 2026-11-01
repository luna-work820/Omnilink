/**
 * Storefront normalize —— 纯转换层（本任务核心）。
 *
 *   database row ──→ normalize ──→ StorefrontProduct
 *
 * 无副作用、无 IO、无 DB 访问。任何单条脏数据（缺图/缺价/缺属性/
 * 畸形 details）都只影响该条本身，绝不让页面崩溃。
 */

import type {
  StorefrontProduct,
  StorefrontProductOption,
  StorefrontProductVariant,
} from './types'
import { readOutboundLinks } from '@/lib/products/outbound-links'

export interface CatalogVariantRow {
  id: string
  title?: string | null
  sku_code?: string | null
  price?: number | string | null
  currency_code?: string | null
  availability_type?: string | null
  availability_value?: number | string | null
  details?: unknown
}

export interface CatalogMediaRow {
  id?: string
  storage_path?: string | null
  media_type?: string | null
  media_role?: string | null
  alt_text?: string | null
  metadata?: unknown
  created_at?: string | null
}

export interface CatalogItemRow {
  id: string
  title: string | null
  description: string | null
  details: unknown
  cover_image?: string | null
  catalog_variants?: CatalogVariantRow[] | null
  catalog_media?: CatalogMediaRow[] | null
}

/** Catalog 查询返回的单条商品行（白名单 select + 关联 media/variants）。 */
export interface StorefrontProductRow {
  id: string
  name: string | null
  description: string | null
  price: number | string | null
  currency: string | null
  details: unknown
  cover_image?: string | null
  media?: Array<{
    url: string | null
    role: string | null
  }> | null
  options?: Array<{
    id: string
    name: string
    code: string
    position?: number
    values: unknown
  }> | null
  variants?: Array<{
    id: string
    sku: string | null
    price: number | string | null
    currency: string | null
    inventory: number | null
    status: string | null
    option_values: unknown
  }> | null
}

export interface NormalizeOptions {
  /** 店铺 slug，用于生成 href。 */
  storeSlug: string
  /** 店铺货币，作为商品 currency 缺失时的回退。 */
  storeCurrency?: string | null
}

function toFiniteNumber(value: number | string | null): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/** 提取画廊图片：优先 original 居首，其余有效 URL 随后，去重。 */
function extractImageGallery(
  assets: StorefrontProductRow['media']
): { primary: string | null; all: string[] } {
  if (!Array.isArray(assets) || assets.length === 0) {
    return { primary: null, all: [] }
  }

  const valid = assets.filter(
    (a): a is { url: string; role: string | null } =>
      typeof a?.url === 'string' && a.url.trim().length > 0
  )

  if (valid.length === 0) {
    return { primary: null, all: [] }
  }

  const urls: string[] = []

  const publicAssets = valid.filter((asset) =>
    ['public', 'processed', 'watermark', 'transparent'].includes(
      asset.role ?? ''
    )
  )

  for (const asset of publicAssets) {
    if (!urls.includes(asset.url)) {
      urls.push(asset.url)
    }
  }

  // Keep original media as a fallback for imported records.
  if (urls.length === 0) {
    const legacyOriginal = valid.find(
      (asset) => asset.role === 'original'
    )

    if (legacyOriginal) {
      urls.push(legacyOriginal.url)
    }
  }

  return {
    primary: urls[0] ?? null,
    all: urls,
  }
}

/**
 * Catalog details 安全拍平：
 * 只保留顶层的 string/number/boolean 叶子；跳过 null、嵌套对象与数组。
 * 不发明新 ontology，不向 UI 暴露内部结构。
 */
function flattenSemanticData(input: unknown): Record<string, string> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = String(value)
    }
  }
  return out
}

/**
 * 从 Catalog details 安全提取扁平属性 Map。
 * 兼容两种存储形态：
 *   - 嵌套：{ attributes: { color: "Black", material: "Acetate" } }
 *   - 扁平：{ color: "Black", material: "Acetate" }
 * 同时兼容值被包裹为 { value: x } 的写法（拍平为 x）。
 * 返回 null 表示输入非对象 / 无可提取内容。
 */
function extractAttributesFromSemantic(
  input: unknown
): Record<string, string> | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return null
  }
  const obj = input as Record<string, unknown>

  // 解嵌套：{ attributes: {...} } → 取内部对象
  const target =
    obj.attributes &&
    typeof obj.attributes === 'object' &&
    !Array.isArray(obj.attributes)
      ? (obj.attributes as Record<string, unknown>)
      : obj

  // 解 { value: x } 包裹（兼容历史写入形态）
  const unwrapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(target)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'value' in (value as Record<string, unknown>)
    ) {
      unwrapped[key] = (value as Record<string, unknown>).value
    } else {
      unwrapped[key] = value
    }
  }

  const flat = flattenSemanticData(unwrapped)
  return Object.keys(flat).length > 0 ? flat : null
}

/** 解析商品公开属性，唯一来源为 Catalog details.attributes。 */
export function resolveCanonicalAttributes(
  row: StorefrontProductRow
): Record<string, string> {
  const details =
    row.details !== null && row.details !== undefined
      ? row.details
      : {}
  const extracted = extractAttributesFromSemantic(details)
  return extracted ?? {}
}

function normalizeOptions(
  rawOptions?: StorefrontProductRow['options']
): StorefrontProductOption[] | undefined {
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) return undefined
  return rawOptions
    .map((opt) => ({
      id: String(opt.id),
      name: String(opt.name || opt.code || 'Option'),
      code: String(opt.code || opt.name || 'opt').toLowerCase(),
      position: typeof opt.position === 'number' ? opt.position : 0,
      values: Array.isArray(opt.values)
        ? opt.values.map((v) => (typeof v === 'string' ? v : String(v?.name || v)))
        : [],
    }))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

function normalizeVariants(
  rawVariants?: StorefrontProductRow['variants']
): StorefrontProductVariant[] | undefined {
  if (!Array.isArray(rawVariants) || rawVariants.length === 0) return undefined
  return rawVariants.map((v) => ({
    id: String(v.id),
    sku: v.sku ? String(v.sku) : null,
    price: v.price !== null && v.price !== undefined ? toFiniteNumber(v.price) : null,
    currency: v.currency ? String(v.currency) : null,
    inventory: typeof v.inventory === 'number' ? v.inventory : null,
    status: v.status ? String(v.status) : 'active',
    optionValues:
      v.option_values && typeof v.option_values === 'object' && !Array.isArray(v.option_values)
        ? (v.option_values as Record<string, string>)
        : {},
  }))
}

export function normalizeProduct(
  row: StorefrontProductRow,
  opts: NormalizeOptions
): StorefrontProduct {
  const id = String(row.id)
  const gallery = extractImageGallery(row.media)
  const options = normalizeOptions(row.options)
  const variants = normalizeVariants(row.variants)
  const details = row.details && typeof row.details === 'object' && !Array.isArray(row.details)
    ? row.details as Record<string, unknown> : {}

  return {
    id,
    name: row.name?.trim() || 'Untitled product',
    // DB 无 slug 列：公开路由使用 /products/[id]，slug 即 id。
    slug: id,
    price: toFiniteNumber(row.price),
    priceMode: details.price_mode === 'inquiry' ? 'inquiry' : details.price_mode === 'free' ? 'free' : 'amount',
    outboundLinks: readOutboundLinks(details.outbound_links),
    currency: row.currency ?? opts.storeCurrency ?? 'USD',
    imageUrl: gallery.primary ?? row.cover_image ?? null,
    images: gallery.all.length > 0 ? gallery.all : (row.cover_image ? [row.cover_image] : []),
    href: `/store/${opts.storeSlug}/products/${id}`,
    description: row.description ?? null,
    attributes: resolveCanonicalAttributes(row),
    badges: [],
    options,
    variants,
  }
}

export function normalizeProducts(
  rows: StorefrontProductRow[],
  opts: NormalizeOptions
): StorefrontProduct[] {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => normalizeProduct(row, opts))
}
