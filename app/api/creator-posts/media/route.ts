import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getOwnedStore, requireUser } from '@/lib/api/auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { CREATOR_MEDIA_BUCKET, creatorMediaTypes, creatorMediaUrl } from '@/lib/creator-publication-document'

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

  const body = await request.json().catch(() => null) as { contentType?: unknown; size?: unknown } | null
  const contentType = body?.contentType
  const media = typeof contentType === 'string' ? creatorMediaTypes[contentType] : null
  if (!media) {
    return NextResponse.json({ error: '仅支持 MP4、WebM、JPG、PNG 或 WebP 素材。' }, { status: 400 })
  }
  if (body?.size !== undefined && (typeof body.size !== 'number' || body.size <= 0 || body.size > media.maxBytes)) return NextResponse.json({ error: '素材大小超出限制。' }, { status: 400 })
  const path = `${store.organization_id}/${auth.user.id}/${randomUUID()}.${media.extension}`
  const service = createServiceRoleClient()
  const { data, error } = await service.storage.from(CREATOR_MEDIA_BUCKET).createSignedUploadUrl(path, { upsert: false })
  if (error || !data) return NextResponse.json({ error: '无法创建素材上传地址' }, { status: 502 })

  return NextResponse.json({ path: data.path, token: data.token, url: creatorMediaUrl(data.path) })
}
