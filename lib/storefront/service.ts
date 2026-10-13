/**
 * Storefront service —— 服务端数据访问层。
 *
 * 查询原则：Database filtering first → Normalization second → Rendering last。
 * 所有过滤（store 归属 / active / published / limit / 排除当前商品）都下推到
 * Supabase 查询，绝不先全量拉取再 JS 过滤。
 *
 * 使用项目既有 server Supabase client（createClientServer），不新建客户端、
 * 不用 service role。查询错误抛给调用方（路由层决定 404/500）；
 * 「不存在」返回 null / []。
 */

import { createClientServer } from '@/lib/supabase/server'
import {
  normalizeProduct,
  normalizeProducts,
  type CatalogItemRow,
  type StorefrontProductRow,
} from './normalize'
import type {
  StorefrontProduct,
  StorefrontStore,
} from './types'
import {
  normalizeStorefrontSchema,
  type StorefrontSchema,
  type StoreContactConfig,
  type StoreSocialConfig,
} from './schema'

/** 商品白名单列：只取 UI 需要的字段，绝不暴露内部原始字段。 */
const CATALOG_SELECT =
  'id, title, description, details, catalog_variants(id, title, sku_code, price, currency_code, availability_type, availability_value), catalog_media(storage_path, media_type, media_role)'

function catalogRow(item: CatalogItemRow): StorefrontProductRow {
  const variant = item.catalog_variants?.[0]
  return {
    id: item.id,
    name: item.title,
    description: item.description,
    price: variant?.price ?? 0,
    currency: variant?.currency_code ?? 'CNY',
    details: item.details,
    media: (item.catalog_media ?? []).map((media) => ({
      url: media.storage_path ?? null,
      role: media.media_role === 'cover' ? 'public' : media.media_type ?? null,
    })),
    variants: (item.catalog_variants ?? []).map((v) => ({
      id: v.id,
      sku: v.sku_code ?? null,
      price: v.price ?? null,
      currency: v.currency_code ?? null,
      inventory: v.availability_type === 'stock' && v.availability_value != null ? Number(v.availability_value) : null,
      status: 'active',
      option_values: v.details ?? {},
    })),
  }
}

async function catalogOrganizationId(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
  storeId: string,
) {
  const { data, error } = await supabase.from('stores').select('organization_id').eq('id', storeId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.organization_id ?? null
}

async function getVisibleStorefrontProductIds(
  supabase: Awaited<ReturnType<typeof createClientServer>>,
  storeId: string,
  organizationId: string,
) {
  const { data: channel, error: channelError } = await supabase.from('sales_channels').select('id')
    .eq('organization_id', organizationId).eq('code', 'storefront').eq('channel_type', 'storefront').eq('status', 'active').limit(1).maybeSingle()
  if (channelError) throw new Error(channelError.message)
  if (!channel) return []

  const { data: assignments, error } = await supabase.from('catalog_item_channels').select('catalog_item_id')
    .eq('organization_id', organizationId).eq('store_id', storeId).eq('channel_id', channel.id).eq('is_visible', true)
  if (error) throw new Error(error.message)
  return (assignments ?? []).map((assignment) => assignment.catalog_item_id)
}

type StoreRef = Pick<StorefrontStore, 'id' | 'slug'> & {
  currency?: string | null
}

export type StorefrontDiscoveryItem = {
  store: Pick<StorefrontStore, 'name' | 'slug'>
  product: StorefrontProduct
}

/**
 * 从 store_settings.theme_config 提取 theme_id。
 * 双形态兼容：canonical（theme.themeId）优先，legacy（theme_id）兜底。
 */
function readThemeId(themeConfig: unknown): string | null {
  if (themeConfig === null || typeof themeConfig !== 'object') return null
  const obj = themeConfig as Record<string, unknown>

  // canonical: { theme: { themeId } }
  if (obj.theme && typeof obj.theme === 'object') {
    const themeId = (obj.theme as Record<string, unknown>).themeId
    if (typeof themeId === 'string' && themeId.length > 0) return themeId
  }

  // legacy: { theme_id }
  const legacy = obj.theme_id
  return typeof legacy === 'string' && legacy.length > 0 ? legacy : null
}

/** 提取全局联系与社交配置 */
function readGlobalInfo(themeConfig: unknown): {
  contact?: StoreContactConfig
  social?: StoreSocialConfig
} {
  if (themeConfig === null || typeof themeConfig !== 'object') return {}
  const obj = themeConfig as Record<string, unknown>
  const globalInfo =
    obj.globalInfo && typeof obj.globalInfo === 'object'
      ? (obj.globalInfo as Record<string, unknown>)
      : null

  const contact = (globalInfo?.contact || obj.contact) as
    | StoreContactConfig
    | undefined
  const social = (globalInfo?.social || obj.social) as
    | StoreSocialConfig
    | undefined

  return { contact, social }
}

/**
 * 获取公开 storefront 的店铺数据。优先使用当前已发布版本；旧店铺
 * 在创建第一个版本之前，继续使用 store_pages 的发布位。
 */
export async function getPublishedStore(
  storeSlug: string
): Promise<StorefrontStore | null> {
  const supabase = await createClientServer()

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name, slug, currency')
    .eq('slug', storeSlug)
    .eq('status', 'active')
    .maybeSingle()

  if (storeError && storeSlug !== 'omnilink-flagship') throw new Error(storeError.message)
  if (!store || storeError) {
    if (storeSlug === 'omnilink-flagship') {
      return {
        id: 'demo-store',
        name: 'Omnilink 旗舰店',
        slug: 'omnilink-flagship',
        description: 'AI 原生智能电商示范旗舰店',
        logoUrl: null,
        currency: 'CNY',
        themeId: 'minimal',
        contact: {
          email: 'concierge@omnilink.ai',
          whatsapp: '+1 (555) 019-2834',
          phone: '+1 (555) 019-2834',
          address: '77 Atelier Way, Suite 400, San Francisco, CA',
        },
        social: {
          instagram: 'https://instagram.com/omnilink',
          x: 'https://x.com/omnilink',
        },
      }
    }
    return null
  }

  const { data: publishedVersion, error: versionError } = await supabase
    .from('published_storefronts')
    .select('schema_document')
    .eq('store_id', store.id)
    .maybeSingle()
  if (versionError) throw new Error(versionError.message)

  if (publishedVersion?.schema_document) {
    const schema = normalizeStorefrontSchema(publishedVersion.schema_document)
    if (!schema) return null
    const { contact, social } = readGlobalInfo(publishedVersion.schema_document)
    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      description: null,
      logoUrl: null,
      currency: store.currency,
      themeId: schema.theme.themeId,
      contact: contact || schema.globalInfo?.contact,
      social: social || schema.globalInfo?.social,
    }
  }

  const { data: publishedPage, error: pageError } = await supabase
    .from('store_pages')
    .select('id')
    .eq('store_id', store.id)
    .eq('published', true)
    .limit(1)
    .maybeSingle()

  if (pageError) throw new Error(pageError.message)
  if (!publishedPage) return null

  const { data: settings, error: settingsError } = await supabase
    .from('store_settings')
    .select('theme_config')
    .eq('store_id', store.id)
    .maybeSingle()

  if (settingsError) throw new Error(settingsError.message)

  const { contact, social } = readGlobalInfo(settings?.theme_config)

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: null,
    logoUrl: null,
    currency: store.currency,
    themeId: readThemeId(settings?.theme_config),
    contact,
    social,
  }
}

/**
 * 公开店面入口：优先读取版本指针指向的页面，兼容尚未迁移的旧店铺。
 */
export async function getPublicStorefront(
  storeSlug: string
): Promise<{ store: StorefrontStore; schema: StorefrontSchema } | null> {
  try {
    const supabase = await createClientServer()

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, slug, currency')
      .eq('slug', storeSlug)
      .eq('status', 'active')
      .maybeSingle()

    if (storeError) {
      console.error('getPublicStorefront store error:', storeError.message)
    }

    if (!store) {
      if (storeSlug === 'omnilink-flagship') {
        const demoSchema = normalizeStorefrontSchema({ theme_id: 'minimal' })!
        return {
          store: {
            id: 'demo-store',
            name: 'Omnilink 旗舰店',
            slug: 'omnilink-flagship',
            description: 'AI 原生智能电商示范旗舰店',
            logoUrl: null,
            currency: 'CNY',
            themeId: demoSchema.theme.themeId,
            contact: demoSchema.globalInfo?.contact,
            social: demoSchema.globalInfo?.social,
          },
          schema: {
            ...demoSchema,
            meta: { ...demoSchema.meta, published: true },
          },
        }
      }
      return null
    }

    const { data: publishedVersion, error: versionError } = await supabase
      .from('published_storefronts')
      .select('schema_document')
      .eq('store_id', store.id)
      .maybeSingle()
    if (versionError) throw new Error(versionError.message)

    if (publishedVersion?.schema_document) {
      const publishedSchema = normalizeStorefrontSchema(publishedVersion.schema_document)
      if (!publishedSchema) return null
      const { contact, social } = readGlobalInfo(publishedVersion.schema_document)
      return {
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          description: null,
          logoUrl: null,
          currency: store.currency,
          themeId: publishedSchema.theme.themeId,
          contact: contact || publishedSchema.globalInfo?.contact,
          social: social || publishedSchema.globalInfo?.social,
        },
        schema: publishedSchema,
      }
    }

    const { data: settings, error: settingsError } = await supabase
      .from('store_settings')
      .select('theme_config')
      .eq('store_id', store.id)
      .maybeSingle()

    if (settingsError) throw new Error(settingsError.message)

    const rawConfig = settings?.theme_config
    let schema = normalizeStorefrontSchema(rawConfig)
    const { contact, social } = readGlobalInfo(rawConfig)

    const isLegacyConfig =
      rawConfig !== null &&
      typeof rawConfig === 'object' &&
      typeof (rawConfig as Record<string, unknown>).theme_id === 'string' &&
      !(rawConfig as Record<string, unknown>).version

    if (schema && isLegacyConfig) {
      schema = {
        ...schema,
        sections: schema.sections.map((s) =>
          s.type === 'hero'
            ? {
                ...s,
                content: {
                  ...s.content,
                  title: store.name,
                  description: s.content.description,
                },
              }
            : s
        ),
      }
    }

    const { data: publishedPage, error: pageError } = await supabase
      .from('store_pages')
      .select('id')
      .eq('store_id', store.id)
      .eq('published', true)
      .limit(1)
      .maybeSingle()

    if (pageError) throw new Error(pageError.message)
    if (!publishedPage) return null

    if (schema) {
      schema = { ...schema, meta: { ...schema.meta, published: true } }
    } else {
      const base = normalizeStorefrontSchema({ theme_id: 'minimal' })
      if (!base) return null
      schema = {
        ...base,
        sections: base.sections.map((s) =>
          s.type === 'hero'
            ? {
                ...s,
                content: {
                  ...s.content,
                  title: store.name,
                  description: s.content.description,
                },
              }
            : s
        ),
        meta: { ...base.meta, published: true },
      }
    }

    if (!schema) return null

    return {
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: null,
        logoUrl: null,
        currency: store.currency,
        themeId: schema.theme.themeId,
        contact: contact || schema.globalInfo?.contact,
        social: social || schema.globalInfo?.social,
      },
      schema,
    }
  } catch (err) {
    console.error('getPublicStorefront error:', err)
    if (storeSlug === 'omnilink-flagship') {
      const demoSchema = normalizeStorefrontSchema({ theme_id: 'minimal' })!
      return {
        store: {
          id: 'demo-store',
          name: 'Omnilink 旗舰店',
          slug: 'omnilink-flagship',
          description: 'AI 原生智能电商示范旗舰店',
          logoUrl: null,
          currency: 'CNY',
          themeId: demoSchema.theme.themeId,
          contact: demoSchema.globalInfo?.contact,
          social: demoSchema.globalInfo?.social,
        },
        schema: {
          ...demoSchema,
          meta: { ...demoSchema.meta, published: true },
        },
      }
    }
    return null
  }
}

/** 店铺公开商品列表（active、按创建时间倒序、限量）。 */
export async function getStorefrontProducts(
  storeOrId: StoreRef | { id: string; store_slug?: string; currency?: string | null } | string,
  limit = 24
): Promise<StorefrontProduct[]> {
  const storeId = typeof storeOrId === 'string' ? storeOrId : storeOrId?.id
  const storeSlug = typeof storeOrId === 'string' ? 'store' : ('slug' in storeOrId ? storeOrId.slug : storeOrId.store_slug) || 'store'
  const storeCurrency = typeof storeOrId === 'string' ? null : storeOrId?.currency

  if (!storeId) {
    return []
  }

  try {
    const supabase = await createClientServer()

    const organizationId = await catalogOrganizationId(supabase, storeId)
    if (!organizationId) return []
    const visibleProductIds = await getVisibleStorefrontProductIds(supabase, storeId, organizationId)
    if (!visibleProductIds.length) return []
    const { data, error } = await supabase
      .from('catalog_items')
      .select(CATALOG_SELECT)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .in('id', visibleProductIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[Storefront][getStorefrontProducts] query failed', {
        storeId,
        errorCode: error.code ?? null,
        errorMessage: error.message,
      })
      throw new Error(`Failed to load storefront products: ${error.message}`)
    }

    return normalizeProducts(
      (data ?? []).map(catalogRow),
      { storeSlug, storeCurrency }
    )
  } catch (err) {
    console.error('[Storefront][getStorefrontProducts] exception', {
      storeId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw new Error(`Failed to load storefront products: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * C 端发现页：只聚合已发布店铺及其显式开放到 storefront 渠道的商品。
 * 店铺和商品仍来自同一套 stores / catalog 数据，不维护发现页副本。
 */
export async function getStorefrontDiscoveryItems(limit = 36): Promise<StorefrontDiscoveryItem[]> {
  const supabase = await createClientServer()
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, name, slug, currency')
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) throw new Error(`Failed to load storefront discovery: ${error.message}`)
  if (!stores?.length) return []

  const publishedStores = (await Promise.all(stores.map(async (store) => {
    const published = await getPublishedStore(store.slug)
    return published ? { ...store, published } : null
  }))).filter((store) => store !== null)
  const items = await Promise.all(publishedStores.map(async (store) => {
    const products = await getStorefrontProducts(store, Math.min(limit, 12))
    return products.map((product) => ({
      store: { name: store.published.name, slug: store.published.slug },
      product,
    }))
  }))

  return items.flat().slice(0, limit)
}

/**
 * 单个公开商品。组织 + 商品 id 双重过滤。
 */
export async function getStorefrontProduct(
  store: StoreRef,
  productId: string
): Promise<StorefrontProduct | null> {
  const supabase = await createClientServer()
  const organizationId = await catalogOrganizationId(supabase, store.id)
  if (!organizationId) return null
  const visibleProductIds = await getVisibleStorefrontProductIds(supabase, store.id, organizationId)
  if (!visibleProductIds.includes(productId)) return null
  const { data, error } = await supabase
    .from('catalog_items')
    .select(CATALOG_SELECT)
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
    ? normalizeProduct(catalogRow(data), { storeSlug: store.slug, storeCurrency: store.currency })
    : null
}

/**
 * 相关商品。
 */
export async function getRelatedProducts(
  store: StoreRef,
  productId: string,
  limit = 4
): Promise<StorefrontProduct[]> {
  const supabase = await createClientServer()

  const organizationId = await catalogOrganizationId(supabase, store.id)
  if (!organizationId) return []
  const visibleProductIds = await getVisibleStorefrontProductIds(supabase, store.id, organizationId)
  if (!visibleProductIds.length) return []
  const { data, error } = await supabase
    .from('catalog_items')
    .select(CATALOG_SELECT)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .neq('id', productId)
    .in('id', visibleProductIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return normalizeProducts(
    (data ?? []).map(catalogRow),
    { storeSlug: store.slug, storeCurrency: store.currency }
  )
}
