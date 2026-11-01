import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getOwnedStore, requireUser } from '@/lib/api/auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

const VIDEO_BUCKET = 'creator-content-videos'

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const ownedStore = await getOwnedStore(auth.supabase, auth.user)
  if (!ownedStore) return NextResponse.json({ error: '请先完成发布者设置' }, { status: 404 })

  const { data: store, error: storeError } = await auth.supabase
    .from('stores')
    .select('organization_id')
    .eq('id', ownedStore.id)
    .maybeSingle()
  if (storeError || !store) return NextResponse.json({ error: '无法确认发布空间' }, { status: 404 })

  const body = await request.json().catch(() => null) as { contentType?: unknown } | null
  const contentType = body?.contentType
  if (contentType !== 'video/mp4' && contentType !== 'video/webm') {
    return NextResponse.json({ error: '仅支持 MP4 或 WebM 视频' }, { status: 400 })
  }

  const extension = contentType === 'video/mp4' ? 'mp4' : 'webm'
  const path = `${store.organization_id}/${auth.user.id}/${randomUUID()}.${extension}`
  const service = createServiceRoleClient()
  const { data, error } = await service.storage.from(VIDEO_BUCKET).createSignedUploadUrl(path, { upsert: false })
  if (error || !data) return NextResponse.json({ error: '无法创建视频上传地址' }, { status: 502 })

  const { data: publicData } = service.storage.from(VIDEO_BUCKET).getPublicUrl(path)
  return NextResponse.json({ path: data.path, token: data.token, publicUrl: publicData.publicUrl })
}
