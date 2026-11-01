import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { getOwnedStore, requireUser } from '@/lib/api/auth'
import { readOutboundLinks } from '@/lib/products/outbound-links'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const { id } = await params
  const storeRef = await getOwnedStore(auth.supabase, auth.user)
  if (!storeRef) return NextResponse.json({ error: '请先完成发布者设置' }, { status: 404 })

  const { data: store, error: storeError } = await auth.supabase
    .from('stores')
    .select('id, organization_id, name, slug')
    .eq('id', storeRef.id)
    .maybeSingle()
  if (storeError || !store) return NextResponse.json({ error: storeError?.message || '店铺不存在' }, { status: 404 })

  const { data: product, error: productError } = await auth.supabase
    .from('catalog_items')
    .select('id, item_type, details')
    .eq('id', id)
    .eq('organization_id', store.organization_id)
    .maybeSingle()
  if (productError || !product) return NextResponse.json({ error: productError?.message || '商品不存在' }, { status: 404 })
  const details = product.details && typeof product.details === 'object' && !Array.isArray(product.details)
    ? product.details as Record<string, unknown>
    : {}
  if (details.delivery_type === 'ai_capability' || product.item_type === 'skill') {
    return NextResponse.json({ error: '数字能力尚未接通交付，暂不能上架' }, { status: 422 })
  }
  if (!Object.keys(readOutboundLinks(details.outbound_links)).length) {
    return NextResponse.json({ error: '发布前请填写有效的小红书或抖音跳转链接' }, { status: 422 })
  }
  if (details.price_mode !== 'inquiry' && details.price_mode !== 'amount' && details.price_mode !== 'free') {
    return NextResponse.json({ error: '请选择价格、询价或免费' }, { status: 422 })
  }

  const { data: variant, error: variantError } = await auth.supabase
    .from('catalog_variants')
    .select('id')
    .eq('catalog_item_id', id)
    .eq('organization_id', store.organization_id)
    .limit(1)
    .maybeSingle()
  if (variantError || !variant) return NextResponse.json({ error: variantError?.message || '请先保存商品售价与销售规格' }, { status: 422 })

  const { data: channel, error: channelError } = await auth.supabase
    .from('sales_channels')
    .select('id')
    .eq('organization_id', store.organization_id)
    .eq('code', 'storefront')
    .eq('channel_type', 'storefront')
    .eq('status', 'active')
    .maybeSingle()
  if (channelError || !channel) return NextResponse.json({ error: channelError?.message || '发布渠道尚未启用' }, { status: 409 })

  const { data: assignment, error: assignmentError } = await auth.supabase
    .from('catalog_item_channels')
    .select('id')
    .eq('organization_id', store.organization_id)
    .eq('catalog_item_id', id)
    .eq('channel_id', channel.id)
    .eq('store_id', store.id)
    .maybeSingle()
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 })

  const values = { is_visible: true, is_purchasable: false, published_at: new Date().toISOString() }
  const result = assignment
    ? await auth.supabase.from('catalog_item_channels').update(values).eq('id', assignment.id)
    : await auth.supabase.from('catalog_item_channels').insert({
      organization_id: store.organization_id,
      catalog_item_id: id,
      channel_id: channel.id,
      store_id: store.id,
      ...values,
    })
  if (result.error) {
    return NextResponse.json({ error: `发布到发现页失败：${result.error.message}` }, { status: 500 })
  }

  // Public discovery only reads active items.
  const { error: activateError } = await auth.supabase
    .from('catalog_items')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('organization_id', store.organization_id)
  if (activateError) return NextResponse.json({ error: activateError.message }, { status: 500 })

  revalidatePath('/discover')
  return NextResponse.json({ published: true })
}
