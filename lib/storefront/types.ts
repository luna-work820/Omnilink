/**
 * Storefront 数据契约 —— UI 与数据库之间的稳定边界（白名单 DTO）。
 *
 * 原则：
 *   - UI 需要什么就提供什么；数据库有什么不代表全部暴露。
 *   - 组件只允许消费本文件的类型，禁止直接读 DB 行 / semantic_data。
 *   - 本层与 lib/themes 完全独立（互不 import）。
 *
 * 字段口径（以当前实际 schema 为准）：
 *   - Catalog 商品使用 id 作为公开路由段（公开路由本就是 /products/[id]）。
 *   - 图片取 catalog_media.storage_path。
 *   - attributes 来自 catalog_items.details.attributes 的安全拍平。
 */

import type { StoreContactConfig, StoreSocialConfig } from './schema'

export interface StorefrontProductOptionValue {
  name: string
  priceDelta?: number
}

export interface StorefrontProductOption {
  id: string
  name: string
  code: string
  position?: number
  values: string[] | StorefrontProductOptionValue[]
}

export interface StorefrontProductVariant {
  id: string
  sku?: string | null
  price?: number | null
  currency?: string | null
  inventory?: number | null
  status?: string | null
  optionValues: Record<string, string>
}

export interface StorefrontProduct {
  /** 稳定识别（DB uuid）。 */
  id: string
  /** UI 展示名（normalize 统一 name 口径）。 */
  name: string
  /** 路径段。当前 DB 无 slug 列，= 商品 id。 */
  slug: string
  /** 数值型价格；非法/缺失归一为 0。 */
  price: number
  /** 商品货币；缺省回退店铺货币，最后回退 schema 默认 'USD'。 */
  currency: string
  /** 主图；无图时为 null（UI 负责占位，不在这里猜）。 */
  imageUrl: string | null
  /** 多图画廊（包含主图在内的所有有效图）。 */
  images?: string[]
  /** normalize 预生成，组件不自行拼 URL。 */
  href: string
  /** 允许为空。 */
  description: string | null
  /** catalog_items.details.attributes 的安全拍平（仅原始类型叶子）。 */
  attributes: Record<string, string>
  /** 扩展点：当前无稳定 badge 规则，保持空数组。 */
  badges?: string[]
  /** 可选商品规格维度（如颜色、材质、尺码）。 */
  options?: StorefrontProductOption[]
  /** 可选 SKU 变体集合。 */
  variants?: StorefrontProductVariant[]
}

export interface StorefrontStore {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  currency: string
  /**
   * 商家主题选择的原始值（store_settings.theme_config.theme_id）。
   * 可能为 null；未知 id 的回退由 lib/themes registry 在渲染层处理。
   */
  themeId: string | null
  /** 全局联系信息（Email, WhatsApp, Phone, Address）。 */
  contact?: StoreContactConfig
  /** 全局社交媒体链接。 */
  social?: StoreSocialConfig
}

/**
 * 购物车单项数据模型（Client-side State + Server Recalculation）。
 */
export interface CartItem {
  id: string // `${productId}_${variantId || 'default'}`
  productId: string
  variantId?: string | null
  quantity: number
  productName: string
  image: string | null
  price: number
  currency: string
  selectedOptions?: Record<string, string>
  sku?: string | null
}

/**
 * 商品集合。当前 DB 无 collections 表 —— 集合是展示层分组概念
 * （如「Featured」），为 Collection 模板预留的稳定结构。
 */
export interface StorefrontCollection {
  id: string
  title: string
  products: StorefrontProduct[]
}
