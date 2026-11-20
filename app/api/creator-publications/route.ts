import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/api/auth'
import { creatorPublicationStore, verifyPublicationAssets } from '@/lib/creator-publication-service'
import { parsePublicationDocument, publicationValidation, remotePublication } from '@/lib/creator-publication-document'
import { isUuid } from '@/lib/utils/uuid'

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !isUuid(id)) return NextResponse.json({ error: '内容编号无效。' }, { status: 400 })
  const store = await creatorPublicationStore(auth)
  if (!store) return NextResponse.json({ error: '请先完成创作者设置。' }, { status: 404 })
  const { data, error } = await auth.supabase.rpc('get_creator_publication_for_editor', { p_store_id: store.id, p_id: id })
  if (error) return NextResponse.json({ error: '内容读取失败。' }, { status: 503 })
  const record = data?.[0] ? remotePublication(data[0]) : null
  return record ? NextResponse.json({ record }) : NextResponse.json({ error: '内容不存在。' }, { status: 404 })
}

async function save(request: NextRequest, updating: boolean) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => null)
  if (!body || updating && !isUuid(body.id)) return NextResponse.json({ error: '内容字段无效。' }, { status: 400 })
  const action = updating && ['archive', 'restore'].includes(body.action) ? body.action : 'save'
  const document = action === 'save' ? parsePublicationDocument(body.document) : null
  if (action === 'save' && !document) return NextResponse.json({ error: '内容格式无效，请检查素材和发布设置。' }, { status: 400 })
  const validation = document ? publicationValidation(document, body.status) : null
  if (validation) return NextResponse.json({ error: validation }, { status: 422 })
  try {
    const store = await creatorPublicationStore(auth)
    if (!store) return NextResponse.json({ error: '请先完成创作者设置。' }, { status: 404 })
    const paths = document ? await verifyPublicationAssets(document, store.organization_id) : []
    const { data, error } = await auth.supabase.rpc('manage_creator_publication', {
      p_store_id: store.id, p_id: updating ? body.id : null, p_action: action,
      p_document: document, p_status: document ? body.status : 'draft', p_paths: paths,
    })
    if (error) return NextResponse.json({ error: error.code === 'P0002' ? '内容不存在。' : '保存失败，请刷新后重试。' }, { status: error.code === 'P0002' ? 404 : error.code === '42501' ? 403 : 500 })
    const record = remotePublication(Array.isArray(data) ? data[0] : data)
    if (!record && action !== 'save') { revalidatePath('/discover'); return NextResponse.json({ id: body.id }) }
    if (!record) return NextResponse.json({ error: '内容已保存，但返回格式无效，请刷新内容管理。' }, { status: 500 })
    revalidatePath('/discover'); revalidatePath('/dashboard/content/manage')
    return NextResponse.json({ record }, { status: updating ? 200 : 201 })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : '保存失败，请重试。' }, { status: 422 })
  }
}
export const POST = (request: NextRequest) => save(request, false)
export const PATCH = (request: NextRequest) => save(request, true)
