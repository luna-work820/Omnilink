import {
  createClientServer,
} from '@/lib/supabase/server'

import {
  getCanonicalProductAttributes,
} from '@/lib/products/canonical-attributes'

import type {
  ProductManagementModel,
  ProductStatus,
} from './product-management-model'

type JsonRecord = Record<string, unknown>

type CatalogManagementVariant = {
  sku_code: string | null
  price: number | string | null
  currency_code: string | null
  availability_type: string | null
  availability_value: number | string | null
}

type CatalogManagementMedia = {
  id: string
  storage_path: string | null
  media_type: string | null
  alt_text: string | null
  metadata: unknown
  created_at: string | null
}

type CatalogManagementRow = {
  id: string
  title: string | null
  name?: string
  description: string | null
  status: string | null
  details: unknown
  updated_at: string | null
  sku?: string | null
  catalog_variants?: CatalogManagementVariant[] | null
  catalog_media?: CatalogManagementMedia[] | null
}

function isRecord(
  value: unknown,
): value is JsonRecord {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value),
  )
}

function readStatus(
  value: unknown,
): ProductStatus {
  if (
    value === 'active' ||
    value === 'archived'
  ) {
    return value
  }

  return 'draft'
}

import { isUuid, toValidUuid } from '@/lib/utils/uuid'

export async function loadProductManagementModel(
  productId: string,
): Promise<ProductManagementModel> {
  const supabase =
    await createClientServer()

  const targetId = isUuid(productId) ? productId : toValidUuid(productId)

  const { data: catalogRow } = await supabase
    .from('catalog_items')
    .select('id, title, description, status, details, updated_at, catalog_variants(id, sku_code, price, currency_code, availability_type, availability_value), catalog_media(id, storage_path, media_type, alt_text, metadata, created_at)')
    .eq('id', targetId)
    .maybeSingle()

  const catalogData = catalogRow as CatalogManagementRow | null
  const variant = Array.isArray(catalogData?.catalog_variants)
    ? catalogData.catalog_variants[0]
    : null
  const data = catalogData || {
    id: productId,
    title: 'Untitled Product',
    name: 'Untitled Product',
    sku: null,
    description: null,
    price: 0,
    currency: 'CNY',
    inventory: 0,
    status: 'draft',
    details: {},
    updated_at: new Date().toISOString(),
  }

  const rawData = isRecord(data.details)
    ? data.details
    : {}

  const canonical =
    await getCanonicalProductAttributes(
      productId,
    )

  const packaging =
    isRecord(rawData.packaging)
      ? rawData.packaging
      : null

  const seo =
    isRecord(rawData.seo)
      ? {
          title:
            typeof rawData.seo.title === 'string'
              ? rawData.seo.title
              : undefined,

          description:
            typeof rawData.seo.description === 'string'
              ? rawData.seo.description
              : undefined,
        }
      : null

  return {
    id: data.id,
    name: data.title ?? data.name ?? '',
    sku: variant?.sku_code ?? data.sku ?? null,
    description:
      data.description ?? null,

    price:
      variant?.price != null ? Number(variant.price) : 0,

    currency:
      variant?.currency_code ?? 'CNY',

    inventory:
      variant?.availability_type === 'stock'
        ? Number(variant.availability_value ?? 0)
        : 0,

    status: readStatus(
      data.status,
    ),

    categoryId:
      typeof rawData.category_id === 'string'
        ? rawData.category_id
        : null,

    category:
      canonical.category ??
      (typeof rawData.category === 'string'
        ? rawData.category
        : null),

    attributes:
      canonical.attributes,

    packaging,
    seo,

    metadata: {
      schemaId:
        canonical.schema_id,
      schemaVersion:
        canonical.schema_version,
      isComplete:
        canonical.is_complete,
      isLegacy:
        canonical.is_legacy,
    },

    updatedAt:
      data.updated_at ?? null,
  }
}

export async function loadProductDetailModel(
  productId: string,
): Promise<import('./product-detail-model').ProductDetailModel> {
  const { buildProductDetailModel } = await import('./product-detail-model')
  const product = await loadProductManagementModel(productId)
  const targetId = isUuid(productId) ? productId : toValidUuid(productId)

  let media: import('./product-media').ProductMediaAsset[] = []
  try {
    const supabase = await createClientServer()
    // NOTE: Catalog media has no `position` column (never created by any
    // migration). Selecting or ordering by it makes PostgREST fail the whole
    // query with 42703, so media silently came back empty even after a
    // successful upload. Gallery order falls back to upload order (created_at)
    // and `position` below is filled from the array index.
    const { data: mediaData } = await supabase
      .from('catalog_media')
      .select('id, storage_path, media_type, alt_text, metadata, created_at')
      .eq('catalog_item_id', targetId)
      .order('created_at', { ascending: true })

    if (Array.isArray(mediaData)) {
      media = mediaData.map((item: CatalogManagementMedia, index: number) => {
        const metadata = isRecord(item.metadata) ? item.metadata : {}
        return {
        id: item.id,
        url: item.storage_path ?? '',
        mediaType: item.media_type === 'video' ? 'video' : 'image',
        position: index,
        alt: item.alt_text ?? (typeof metadata.alt === 'string' ? metadata.alt : null),
        mimeType: typeof metadata.mimeType === 'string' ? metadata.mimeType : null,
        width: typeof metadata.width === 'number' ? metadata.width : null,
        height: typeof metadata.height === 'number' ? metadata.height : null,
        duration: typeof metadata.duration === 'number' ? metadata.duration : null,
        metadata,
        }
      })
    }
  } catch {
    media = []
  }

  const relations: import('./product-relations').ProductRelation[] = []

  return buildProductDetailModel(product, media, relations)
}
