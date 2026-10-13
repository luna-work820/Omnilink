import { NextRequest, NextResponse } from 'next/server'
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
  const itemUpdate: Record<string, unknown> = {}
  if (typeof body.name === 'string' || typeof body.title === 'string') itemUpdate.title = body.name ?? body.title
  if (typeof body.description === 'string') itemUpdate.description = body.description
  if (typeof body.status === 'string' && ['draft', 'active', 'archived'].includes(body.status)) itemUpdate.status = body.status
  if (body.raw_data && typeof body.raw_data === 'object' && !Array.isArray(body.raw_data)) {
    const { data: currentItem } = await auth.supabase
      .from('catalog_items')
      .select('details')
      .eq('id', targetId)
      .single()
    const currentDetails = currentItem?.details && typeof currentItem.details === 'object' && !Array.isArray(currentItem.details)
      ? currentItem.details as Record<string, unknown>
      : {}
    itemUpdate.details = { ...currentDetails, ...body.raw_data }
  }
  const { data: product, error: productError } = await auth.supabase.from('catalog_items').update(itemUpdate).eq('id', targetId).select('*, catalog_variants(*), catalog_media(*)').single()
  if (productError || !product) return NextResponse.json({ error: productError?.message ?? 'Update failed' }, { status: 500 })
  const variant = product.catalog_variants?.[0]
  const variantUpdate: Record<string, unknown> = {}
  if (typeof body.sku === 'string') variantUpdate.sku_code = body.sku
  if (body.price !== undefined && Number.isFinite(Number(body.price))) variantUpdate.price = Number(body.price)
  if (body.currency !== undefined) variantUpdate.currency_code = body.currency
  if (body.inventory !== undefined && Number.isFinite(Number(body.inventory))) variantUpdate.availability_value = Math.max(0, Number(body.inventory))
  if (variant && Object.keys(variantUpdate).length > 0) await auth.supabase.from('catalog_variants').update(variantUpdate).eq('id', variant.id)
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
