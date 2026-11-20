import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api/auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { encodeAvatar } from '@/lib/image-processing'

export const runtime = 'nodejs'

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: '请选择 JPG、PNG 或 WebP 图片。' }, { status: 400 })
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: '图片请控制在 5 MB 以内。' }, { status: 400 })
  }

  try {
    const image = await encodeAvatar(Buffer.from(await file.arrayBuffer()))
    const path = `consumer-avatars/${auth.user.id}/avatar.webp`
    const storage = createServiceRoleClient().storage.from('omnilink-media-public')
    const { error } = await storage.upload(path, image, {
      upsert: true,
      cacheControl: '3600',
      contentType: 'image/webp',
    })
    if (error) throw error
    const { data } = storage.getPublicUrl(path)
    return NextResponse.json({ avatarUrl: `${data.publicUrl}?v=${Date.now()}` })
  } catch {
    return NextResponse.json({ error: '头像上传失败，请重试。' }, { status: 502 })
  }
}
