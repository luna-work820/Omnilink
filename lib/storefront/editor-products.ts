/**
 * Editor-only product read for the Storefront Visual Editor.
 *
 * This intentionally diverges from getStorefrontProducts (public): it also
 * returns DRAFT products so the editor can preview freshly created items that
 * have not been activated yet. It must NEVER be used on the public storefront
 * route — that route keeps using getStorefrontProducts, which is restricted to
 * `status = 'active'` so drafts never leak to visitors.
 *
 * Reuses the existing normalization layer (normalizeProducts / StorefrontProduct)
 * — no duplication of the conversion logic.
 */

import { createClientServer } from '@/lib/supabase/server'
import {
  normalizeProducts,
  type CatalogItemRow,
  type StorefrontProductRow,
} from './normalize'
import type { StorefrontProduct } from './types'

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
    media: (item.catalog_media ?? []).map((media) => ({ url: media.storage_path ?? null, role: media.media_role === 'cover' ? 'public' : media.media_type ?? null })),
    variants: (item.catalog_variants ?? []).map((v) => ({
      id: v.id, sku: v.sku_code ?? null, price: v.price ?? null, currency: v.currency_code ?? null,
      inventory: v.availability_type === 'stock' && v.availability_value != null ? Number(v.availability_value) : null,
      status: 'active', option_values: v.details ?? {},
    })),
  }
}

type EditorStoreRef =
  | string
  | { id: string; slug?: string; store_slug?: string; currency?: string | null }

/**
 * 编辑器商品读取：store_id 匹配 + status in ('active', 'draft')，按创建时间倒序。
 * 供 Dashboard Storefront Visual Editor 使用，让 draft 商品也能在装修器中预览。
 */
export async function getEditorStorefrontProducts(
  storeOrId: EditorStoreRef,
  limit = 24
): Promise<StorefrontProduct[]> {
  const storeId = typeof storeOrId === 'string' ? storeOrId : storeOrId?.id
  const storeSlug =
    typeof storeOrId === 'string'
      ? 'store'
      : ('slug' in storeOrId ? storeOrId.slug : storeOrId.store_slug) || 'store'
  const storeCurrency = typeof storeOrId === 'string' ? null : storeOrId?.currency

  // demo-store 走前端回退，不需要查询真实库。
  if (!storeId || storeId === 'demo-store') {
    return []
  }

  try {
    const supabase = await createClientServer()

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('organization_id')
      .eq('id', storeId)
      .maybeSingle()

    if (storeError || !store?.organization_id) return []
    const { data, error } = await supabase
      .from('catalog_items')
      .select(CATALOG_SELECT)
      .eq('organization_id', store.organization_id)
      .in('status', ['active', 'draft'])
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('getEditorStorefrontProducts error:', error.message)
      return []
    }

    const normalized = normalizeProducts(
      (data ?? []).map(catalogRow),
      { storeSlug, storeCurrency }
    )

    return normalized
  } catch (err) {
    console.error('getEditorStorefrontProducts exception:', err)
    return []
  }
}
