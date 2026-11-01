import { NextRequest, NextResponse } from 'next/server'
import { getCategoryById } from '@/lib/product/categories'
import { productTypeFromCategory } from '@/lib/products/virtual-product-category'
import { requireUser, ownsProduct } from '@/lib/api/auth'
import { isUuid, toValidUuid } from '@/lib/utils/uuid'

type CatalogItemResponse = {
  title: string | null
  cover_image?: string | null
  details?: unknown
  catalog_variants?: Array<{
    sku_code?: string | null
    price?: number | string | null
    currency_code?: string | null
    availability_type?: string | null
    availability_value?: number | string | null
  }> | null
  catalog_media?: Array<{ storage_path?: string | null }> | null
}

function mapCatalogItem(item: CatalogItemResponse) {
  const variant = item.catalog_variants?.[0]
  const media = item.catalog_media?.[0]
  return { ...item, name: item.title, sku: variant?.sku_code ?? null, price: variant ? Number(variant.price) : null, currency: variant?.currency_code ?? 'CNY', inventory: variant?.availability_type === 'stock' ? Number(variant.availability_value ?? 0) : null, image_url: media?.storage_path ?? item.cover_image ?? null, raw_data: item.details ?? {}, semantic_data: null }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const targetId = isUuid(id) ? id : toValidUuid(id)
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { owned } = await ownsProduct(auth.supabase, auth.user, targetId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await auth.supabase.from('catalog_items').select('*, catalog_variants(*), catalog_media(*)').eq('id', targetId).single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 404 })
  return NextResponse.json({ product: mapCatalogItem(data) })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const targetId = isUuid(id) ? id : toValidUuid(id)
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { owned } = await ownsProduct(auth.supabase, auth.user, targetId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const { data: currentItem } = await auth.supabase
    .from('catalog_items')
    .select('item_type,details,status')
    .eq('id', targetId)
    .single()
  const currentDetails = currentItem?.details && typeof currentItem.details === 'object' && !Array.isArray(currentItem.details)
    ? currentItem.details as Record<string, unknown>
    : {}
  const requestedDetails = body.raw_data && typeof body.raw_data === 'object' && !Array.isArray(body.raw_data)
    ? body.raw_data as Record<string, unknown>
    : {}
  if (body.delivery_type !== undefined && requestedDetails.delivery_type !== undefined && body.delivery_type !== requestedDetails.delivery_type) {
    return NextResponse.json({ error: 'delivery_type must match raw_data.delivery_type' }, { status: 400 })
  }
  if (body.capability_kind !== undefined && requestedDetails.capability_kind !== undefined && body.capability_kind !== requestedDetails.capability_kind) {
    return NextResponse.json({ error: 'capability_kind must match raw_data.capability_kind' }, { status: 400 })
  }
  const requestedDeliveryType = requestedDetails.delivery_type ?? body.delivery_type ?? currentDetails.delivery_type ?? 'physical'
  if (requestedDeliveryType !== 'physical' && requestedDeliveryType !== 'digital' && requestedDeliveryType !== 'ai_capability') {
    return NextResponse.json({ error: 'Invalid delivery_type' }, { status: 400 })
  }
  if (body.item_type !== undefined && body.item_type !== 'product' && body.item_type !== 'service') {
    return NextResponse.json({ error: 'Invalid item_type' }, { status: 400 })
  }
  const requestedItemType = body.item_type === 'service' ? 'service' : body.item_type === 'product' ? 'product' : currentItem?.item_type ?? 'product'
  if (requestedItemType === 'service' && requestedDeliveryType !== 'physical') {
    return NextResponse.json({ error: '服务类型不能使用数字交付' }, { status: 400 })
  }
  const requestedCapabilityKind = requestedDetails.capability_kind ?? body.capability_kind ?? currentDetails.capability_kind
  const categoryId = typeof requestedDetails.category_id === 'string' ? requestedDetails.category_id : null
  if (categoryId && getCategoryById(categoryId)) {
    const categoryType = productTypeFromCategory(categoryId)
    if (categoryType.deliveryType !== requestedDeliveryType || (categoryType.capabilityKind && categoryType.capabilityKind !== requestedCapabilityKind)) {
      return NextResponse.json({ error: '分类与商品 details 中的交付类型不一致' }, { status: 400 })
    }
  }
  if (requestedDeliveryType === 'ai_capability' && !['question_set', 'skill', 'plugin'].includes(String(requestedCapabilityKind))) {
    return NextResponse.json({ error: 'capability_kind is required for AI capabilities' }, { status: 400 })
  }
  const nextDetails = {
    ...currentDetails,
    ...requestedDetails,
    delivery_type: requestedDeliveryType,
    capability_kind: requestedDeliveryType === 'ai_capability' ? requestedCapabilityKind : null,
  }
  const nextStatus = typeof body.status === 'string' ? body.status : currentItem?.status
  if (requestedDeliveryType === 'ai_capability' && nextStatus === 'active') {
    return NextResponse.json({ error: 'AI capabilities can only remain drafts until delivery is available' }, { status: 422 })
  }
  if (body.status === 'active' && currentItem?.status !== 'active') {
    return NextResponse.json({ error: '请使用商品上架流程完成商城发布' }, { status: 409 })
  }
  const itemUpdate: Record<string, unknown> = {}
  if (typeof body.name === 'string' || typeof body.title === 'string') itemUpdate.title = body.name ?? body.title
  if (typeof body.description === 'string') itemUpdate.description = body.description
  if (typeof body.status === 'string' && ['draft', 'active', 'archived'].includes(body.status)) itemUpdate.status = body.status
  if (body.item_type !== undefined) itemUpdate.item_type = requestedItemType
  if ((body.raw_data && typeof body.raw_data === 'object' && !Array.isArray(body.raw_data)) || body.delivery_type !== undefined || body.capability_kind !== undefined) itemUpdate.details = nextDetails
  const { data: product, error: productError } = await auth.supabase.from('catalog_items').update(itemUpdate).eq('id', targetId).select('*, catalog_variants(*), catalog_media(*)').single()
  if (productError || !product) return NextResponse.json({ error: productError?.message ?? 'Update failed' }, { status: 500 })
  const variant = product.catalog_variants?.[0]
  const variantUpdate: Record<string, unknown> = {}
  if (typeof body.sku === 'string') variantUpdate.sku_code = body.sku
  if (body.price !== undefined && Number.isFinite(Number(body.price))) variantUpdate.price = Number(body.price)
  if (body.currency !== undefined) variantUpdate.currency_code = body.currency
  if (requestedDeliveryType === 'ai_capability' || requestedDeliveryType === 'digital') {
    variantUpdate.availability_type = 'unlimited'
    variantUpdate.availability_value = null
  } else if (currentDetails.delivery_type === 'ai_capability' || currentDetails.delivery_type === 'digital' || currentItem?.item_type !== requestedItemType) {
    variantUpdate.availability_type = requestedItemType === 'service' ? 'capacity' : 'stock'
    variantUpdate.availability_value = Number.isFinite(Number(body.inventory)) ? Math.max(0, Number(body.inventory)) : 0
  } else if (body.inventory !== undefined && Number.isFinite(Number(body.inventory))) {
    variantUpdate.availability_value = Math.max(0, Number(body.inventory))
  }
  if (variant && Object.keys(variantUpdate).length > 0) {
    const { error: variantError } = await auth.supabase.from('catalog_variants').update(variantUpdate).eq('id', variant.id)
    if (variantError) return NextResponse.json({ error: variantError.message }, { status: 500 })
  }
  return NextResponse.json({ product: mapCatalogItem(product) })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const targetId = isUuid(id) ? id : toValidUuid(id)
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { owned } = await ownsProduct(auth.supabase, auth.user, targetId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await auth.supabase.from('catalog_items').delete().eq('id', targetId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { owned } = await ownsProduct(auth.supabase, auth.user, id)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ error: 'Semantic processing is not enabled in the Catalog MVP.' }, { status: 501 })
}
