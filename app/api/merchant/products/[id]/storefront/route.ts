import { NextResponse } from 'next/server'
import { requireUser, getOwnedStore } from '@/lib/api/auth'
import { readOutboundLinks } from '@/lib/products/outbound-links'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (typeof body?.visible !== 'boolean') return NextResponse.json({ error: 'visible 必须为布尔值' }, { status: 400 })

  const storeRef = await getOwnedStore(auth.supabase, auth.user)
  if (!storeRef) return NextResponse.json({ error: '未找到可管理的店铺' }, { status: 404 })
  const { data: store } = await auth.supabase.from('stores').select('id, organization_id').eq('id', storeRef.id).maybeSingle()
  if (!store) return NextResponse.json({ error: '未找到店铺' }, { status: 404 })

  const { data: product } = await auth.supabase.from('catalog_items').select('id, organization_id, status, details')
    .eq('id', id).eq('organization_id', store.organization_id).maybeSingle()
  if (!product) return NextResponse.json({ error: '商品不存在或无权访问' }, { status: 404 })
  if (body.visible && product.status !== 'active') {
    return NextResponse.json({ error: '请先发布商品' }, { status: 409 })
  }
  if (body.visible) {
    const details = product.details && typeof product.details === 'object' && !Array.isArray(product.details)
      ? product.details as Record<string, unknown> : {}
    if (!Object.keys(readOutboundLinks(details.outbound_links)).length) {
      return NextResponse.json({ error: '请先配置有效的渠道跳转链接' }, { status: 422 })
    }
  }

  const { data: channel, error: channelError } = await auth.supabase.from('sales_channels').select('id')
    .eq('organization_id', store.organization_id).eq('code', 'storefront').eq('channel_type', 'storefront').eq('status', 'active').limit(1).maybeSingle()
  if (channelError) return NextResponse.json({ error: channelError.message }, { status: 500 })
  if (!channel) return NextResponse.json({ error: '当前店铺尚未启用 C 端商城渠道' }, { status: 409 })

  const { data: existing, error: lookupError } = await auth.supabase.from('catalog_item_channels').select('id')
    .eq('organization_id', store.organization_id).eq('catalog_item_id', id).eq('channel_id', channel.id).eq('store_id', store.id).maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })

  const values = {
    is_visible: body.visible,
    is_purchasable: false,
    published_at: body.visible ? new Date().toISOString() : null,
  }
  const result = existing
    ? await auth.supabase.from('catalog_item_channels').update(values).eq('id', existing.id)
    : await auth.supabase.from('catalog_item_channels').insert({
      organization_id: store.organization_id,
      catalog_item_id: id,
      channel_id: channel.id,
      store_id: store.id,
      ...values,
    })
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ visible: body.visible })
}
