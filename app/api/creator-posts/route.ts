import { revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'
import { getOwnedStore, requireUser } from '@/lib/api/auth'
import { contentExcerpt, contentProductIds, parseCreatorPostInput, validateCreatorPostPublication, type CreatorPostInput } from '@/lib/creator-content'
import { readOutboundLinks } from '@/lib/products/outbound-links'

type Client = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClientServer>>

async function context(supabase: Client, user: Parameters<typeof getOwnedStore>[1]) {
  const ref = await getOwnedStore(supabase, user)
  if (!ref) return null
  const { data } = await supabase.from('stores').select('id, organization_id').eq('id', ref.id).maybeSingle()
  return data
}

async function validateProducts(supabase: Client, store: { id: string; organization_id: string }, input: CreatorPostInput) {
  const productIds = contentProductIds(input.blocks)
  const { data: products, error } = productIds.length
    ? await supabase.from('catalog_items').select('id, status, details').eq('organization_id', store.organization_id).in('id', productIds)
    : { data: [], error: null }
  if (error) return error.message
  if ((products ?? []).length !== productIds.length) return '部分商品不存在或不属于当前工作台'
  if (input.status === 'draft') return null
  const { data: channel, error: channelError } = await supabase.from('sales_channels').select('id')
    .eq('organization_id', store.organization_id).eq('code', 'storefront').eq('status', 'active').limit(1).maybeSingle()
  if (channelError) return channelError.message
  const { data: assignments, error: assignmentError } = channel
    ? await supabase.from('catalog_item_channels').select('catalog_item_id').eq('store_id', store.id).eq('channel_id', channel.id).eq('is_visible', true).in('catalog_item_id', productIds)
    : { data: [], error: null }
  if (assignmentError) return assignmentError.message
  return validateCreatorPostPublication(input, products ?? [], new Set((assignments ?? []).map((item) => item.catalog_item_id)))
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const store = await context(auth.supabase, auth.user)
  if (!store) return NextResponse.json({ error: '请先完成发布者设置' }, { status: 404 })
  const [postsResult, productsResult] = await Promise.all([
    auth.supabase.rpc('get_creator_posts_for_editor', { p_store_id: store.id }),
    auth.supabase.from('catalog_items').select('id, title, cover_image, details, status, catalog_media!catalog_media_catalog_item_id_fkey(storage_path, media_role)')
      .eq('organization_id', store.organization_id).neq('status', 'archived').order('created_at', { ascending: false }).limit(100),
  ])
  if (postsResult.error || productsResult.error) return NextResponse.json({ error: postsResult.error?.message || productsResult.error?.message }, { status: 500 })
  return NextResponse.json({
    posts: postsResult.data ?? [],
    products: (productsResult.data ?? []).map((product) => {
      const details = product.details && typeof product.details === 'object' && !Array.isArray(product.details)
        ? product.details as Record<string, unknown> : {}
      const media = product.catalog_media?.find((item) => item.media_role === 'cover') ?? product.catalog_media?.[0]
      return { id: product.id, name: product.title, image: media?.storage_path || product.cover_image, status: product.status,
        hasLink: Object.keys(readOutboundLinks(details.outbound_links)).length > 0 }
    }),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const store = await context(auth.supabase, auth.user)
  if (!store) return NextResponse.json({ error: '请先完成发布者设置' }, { status: 404 })
  const input = parseCreatorPostInput(await request.json().catch(() => null))
  if (!input) return NextResponse.json({ error: '内容字段无效' }, { status: 400 })
  const validation = await validateProducts(auth.supabase, store, input)
  if (validation) return NextResponse.json({ error: validation }, { status: 422 })
  const { data, error } = await auth.supabase.from('creator_posts').insert({
    organization_id: store.organization_id, store_id: store.id, author_id: auth.user.id,
    kind: 'note', title: input.title, cover_url: input.coverUrl, body: contentExcerpt(input.blocks),
    product_ids: contentProductIds(input.blocks), blocks: input.blocks, status: input.status,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/discover')
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const store = await context(auth.supabase, auth.user)
  if (!store) return NextResponse.json({ error: '请先完成发布者设置' }, { status: 404 })
  const body = await request.json().catch(() => null)
  const id = body && typeof body.id === 'string' ? body.id : ''
  const input = parseCreatorPostInput(body)
  if (!id || !input) return NextResponse.json({ error: '内容字段无效' }, { status: 400 })
  const { data: existing } = await auth.supabase.from('creator_posts').select('published_at, status')
    .eq('id', id).eq('store_id', store.id).eq('organization_id', store.organization_id).maybeSingle()
  if (!existing) return NextResponse.json({ error: '内容不存在' }, { status: 404 })
  const validation = await validateProducts(auth.supabase, store, input)
  if (validation) return NextResponse.json({ error: validation }, { status: 422 })
  const pending = existing.status === 'published' && input.status === 'draft'
  const changes = pending
    ? { draft_version: { title: input.title, coverUrl: input.coverUrl, blocks: input.blocks }, updated_at: new Date().toISOString() }
    : {
      title: input.title, cover_url: input.coverUrl, body: contentExcerpt(input.blocks),
      product_ids: contentProductIds(input.blocks), blocks: input.blocks, status: input.status,
      draft_version: null,
      published_at: input.status === 'published' ? existing.published_at || new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
  const { error } = await auth.supabase.from('creator_posts').update(changes)
    .eq('id', id).eq('store_id', store.id).eq('organization_id', store.organization_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/discover')
  return NextResponse.json({ id })
}
