import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { getCategoryById } from '@/lib/product/categories'
import { productTypeFromCategory } from '@/lib/products/virtual-product-category'

type ServerSupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClientServer>>
type CatalogVariantRow = {
  sku_code: string | null
  price: number | string | null
  currency_code: string | null
  availability_type: string | null
  availability_value: number | string | null
}
type CatalogMediaRow = { storage_path: string | null }
type CatalogItemRow = {
  id: string
  title: string
  slug: string
  item_type: string
  cover_image?: string | null
  details: unknown
  catalog_variants?: CatalogVariantRow[] | null
  catalog_media?: CatalogMediaRow[] | null
}

type JsonRecord = Record<string, unknown>
function isRecord(value: unknown): value is JsonRecord { return Boolean(value && typeof value === 'object' && !Array.isArray(value)) }
function slugify(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/(^-|-$)/g, '')
  return slug || `product-${Date.now()}`
}
async function resolveCatalogContext(supabase: ServerSupabaseClient, userId: string) {
  const { data: membership, error: membershipError } = await supabase.from('organization_members').select('organization_id, role').eq('user_id', userId).eq('status', 'active').in('role', ['owner', 'admin', 'editor']).limit(1).maybeSingle()
  if (membershipError || !membership) return null
  const { data: store, error: storeError } = await supabase.from('stores').select('id, organization_id, name, slug, currency').eq('organization_id', membership.organization_id).limit(1).maybeSingle()
  if (storeError || !store) return null
  return { organizationId: membership.organization_id, store }
}
function legacyProduct(
  item: CatalogItemRow,
  variant?: CatalogVariantRow,
  media?: CatalogMediaRow,
) {
  return {
    ...item,
    id: item.id,
    name: item.title,
    sku: variant?.sku_code ?? null,
    price: variant ? Number(variant.price) : null,
    currency: variant?.currency_code ?? 'CNY',
    inventory: variant?.availability_type === 'stock' ? Number(variant.availability_value ?? 0) : null,
    image_url: media?.storage_path ?? item.cover_image ?? null,
    raw_data: item.details ?? {},
    semantic_data: null,
  }
}
export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth
  const context = await resolveCatalogContext(supabase, user.id)
  if (!context) return NextResponse.json({ error: 'Store not found', code: 'STORE_NOT_FOUND' }, { status: 404 })
  const { data, error } = await supabase
    .from('catalog_items')
    .select('*, catalog_variants(*), catalog_media(*)')
    .eq('organization_id', context.organizationId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const products = (data ?? []).map((item) => legacyProduct(item, item.catalog_variants?.[0], item.catalog_media?.[0]))
  return NextResponse.json({ products })
}
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { supabase, user } = auth
  const context = await resolveCatalogContext(supabase, user.id)
  if (!context) return NextResponse.json({ error: 'Store not found', code: 'STORE_NOT_FOUND' }, { status: 404 })
  let body: JsonRecord
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  const title = typeof body.name === 'string' ? body.name.trim() : typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const price = Number(body.price ?? 0), inventory = Number(body.inventory ?? 0)
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(inventory) || inventory < 0) return NextResponse.json({ error: 'price and inventory must be non-negative numbers' }, { status: 400 })
  const rawData = isRecord(body.raw_data) ? body.raw_data : {}
  if (body.delivery_type !== undefined && rawData.delivery_type !== undefined && body.delivery_type !== rawData.delivery_type) {
    return NextResponse.json({ error: 'delivery_type must match raw_data.delivery_type' }, { status: 400 })
  }
  if (body.capability_kind !== undefined && rawData.capability_kind !== undefined && body.capability_kind !== rawData.capability_kind) {
    return NextResponse.json({ error: 'capability_kind must match raw_data.capability_kind' }, { status: 400 })
  }
  const deliveryType = body.delivery_type ?? rawData.delivery_type ?? 'physical'
  if (deliveryType !== 'physical' && deliveryType !== 'digital' && deliveryType !== 'ai_capability') {
    return NextResponse.json({ error: 'Invalid delivery_type' }, { status: 400 })
  }
  const capabilityKind = body.capability_kind ?? rawData.capability_kind
  if (body.item_type !== undefined && body.item_type !== 'product' && body.item_type !== 'service') {
    return NextResponse.json({ error: 'Invalid item_type' }, { status: 400 })
  }
  if (body.item_type === 'service' && deliveryType !== 'physical') {
    return NextResponse.json({ error: '服务类型不能使用数字交付' }, { status: 400 })
  }
  const categoryId = typeof rawData.category_id === 'string' ? rawData.category_id : null
  if (categoryId && getCategoryById(categoryId)) {
    const categoryType = productTypeFromCategory(categoryId)
    if (categoryType.deliveryType !== deliveryType || (categoryType.capabilityKind && categoryType.capabilityKind !== capabilityKind)) {
      return NextResponse.json({ error: '分类与商品 details 中的交付类型不一致' }, { status: 400 })
    }
  }
  if (deliveryType === 'ai_capability' && !['question_set', 'skill', 'plugin'].includes(String(capabilityKind))) {
    return NextResponse.json({ error: 'capability_kind is required for AI capabilities' }, { status: 400 })
  }
  if (deliveryType === 'ai_capability' && body.status === 'active') {
    return NextResponse.json({ error: 'AI capabilities can only be saved as drafts until delivery is available' }, { status: 422 })
  }
  if (body.status === 'active') {
    return NextResponse.json({ error: '请先保存商品草稿，再使用上架流程发布' }, { status: 409 })
  }
  const productId = crypto.randomUUID()
  const productInsert = {
    id: productId,
    organization_id: context.organizationId,
    item_type: body.item_type === 'service' ? 'service' : 'product',
    title,
    slug: typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : `${slugify(title)}-${productId}`,
    description: typeof body.description === 'string' ? body.description : null,
    status: 'draft',
    details: {
      ...rawData,
      delivery_type: deliveryType,
      capability_kind: deliveryType === 'ai_capability' ? capabilityKind : null,
      category_path: Array.isArray(body.category_path) ? body.category_path.filter((v): v is string => typeof v === 'string') : [],
      tags: Array.isArray(body.tags) ? body.tags.filter((v): v is string => typeof v === 'string') : [],
    },
  }
  const { data: product, error: productError } = await supabase.from('catalog_items').insert(productInsert).select('*').single()
  if (productError || !product) return NextResponse.json({ error: productError?.message ?? 'Failed to create catalog item' }, { status: 500 })
  const variantInsert = {
    organization_id: context.organizationId,
    catalog_item_id: product.id,
    sku_code: typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : `SKU-${product.id}`,
    title,
    price,
    currency_code: typeof body.currency === 'string' ? body.currency : (context.store.currency ?? 'CNY'),
    availability_type: deliveryType === 'ai_capability' || deliveryType === 'digital' ? 'unlimited' : product.item_type === 'product' ? 'stock' : 'capacity',
    availability_value: deliveryType === 'ai_capability' || deliveryType === 'digital' ? null : Math.floor(inventory),
  }
  const { data: variant, error: variantError } = await supabase.from('catalog_variants').insert(variantInsert).select('*').single()
  if (variantError || !variant) {
    await supabase.from('catalog_items').delete().eq('id', product.id)
    return NextResponse.json({ error: variantError?.message ?? 'Failed to create SKU' }, { status: 500 })
  }
  return NextResponse.json({ product: legacyProduct(product, variant), variant }, { status: 201 })
}
