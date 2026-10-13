import { NextRequest, NextResponse } from 'next/server'
import { requireUser, ownsProduct } from '@/lib/api/auth'

// Legacy asset endpoint backed by Catalog media.
export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const url = new URL(request.url)
  const productId = url.searchParams.get('product_id')
  if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
  if (!(await ownsProduct(auth.supabase, auth.user, productId)).owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let query = auth.supabase.from('catalog_media').select('*').eq('catalog_item_id', productId)
  const assetType = url.searchParams.get('asset_type')
  if (assetType) query = query.eq('media_role', assetType)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assets: (data ?? []).map((asset) => ({ ...asset, product_id: asset.catalog_item_id, asset_type: asset.media_role, url: asset.storage_path })) })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  const productId = typeof body?.product_id === 'string' ? body.product_id : ''
  if (!productId) return NextResponse.json({ error: 'product_id is required' }, { status: 400 })
  if (!(await ownsProduct(auth.supabase, auth.user, productId)).owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const storagePath = typeof body?.url === 'string' ? body.url : ''
  if (!storagePath) return NextResponse.json({ error: 'url is required' }, { status: 400 })
  const { data: item, error: itemError } = await auth.supabase
    .from('catalog_items')
    .select('organization_id')
    .eq('id', productId)
    .maybeSingle()
  if (itemError || !item) return NextResponse.json({ error: itemError?.message ?? 'Not found' }, { status: 404 })
  const insert = {
    catalog_item_id: productId,
    organization_id: item.organization_id,
    media_type: 'image',
    media_role: typeof body?.asset_type === 'string' ? body.asset_type : 'detail',
    storage_path: storagePath,
    metadata: body?.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  }
  const { data: asset, error } = await auth.supabase.from('catalog_media').insert(insert).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ asset }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const assetId = typeof body?.asset_id === 'string' ? body.asset_id : ''
  if (!assetId) return NextResponse.json({ error: 'asset_id is required' }, { status: 400 })

  const { data: asset, error: lookupError } = await auth.supabase
    .from('catalog_media')
    .select('id, catalog_item_id')
    .eq('id', assetId)
    .maybeSingle()

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  if (!(await ownsProduct(auth.supabase, auth.user, asset.catalog_item_id)).owned) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error: deleteError } = await auth.supabase
    .from('catalog_media')
    .delete()
    .eq('id', assetId)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
