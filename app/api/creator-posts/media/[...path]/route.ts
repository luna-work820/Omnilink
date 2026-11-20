import { NextRequest, NextResponse } from 'next/server'
import { resolveRequestUser } from '@/lib/api/request-user'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { CREATOR_VIDEO_BUCKET, creatorVideoUrl, isCreatorVideoPath } from '@/lib/creator-video'
import { creatorMediaPath } from '@/lib/creator-publication-document'

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/')
  if (!creatorMediaPath('/api/creator-posts/media/' + path)) return NextResponse.json({ error: '素材不存在。' }, { status: 404 })
  const auth = await resolveRequestUser(request)
  if (!auth.ok) return auth.response
  const organizationId = path.split('/')[0]
  const { data: assets, error: assetError } = await auth.supabase.from('creator_post_assets').select('path').eq('path', path).limit(1)
  if (assetError) return NextResponse.json({ error: '暂时无法验证素材权限。' }, { status: 503 })
  const { data: published, error } = !assets?.length && isCreatorVideoPath(path) ? await auth.supabase.from('creator_posts').select('id')
    .eq('organization_id', organizationId).eq('status', 'published').eq('visibility', 'public')
    .contains('blocks', [{ type: 'video', url: creatorVideoUrl(path) }]).limit(1) : { data: [], error: null }
  if (error) return NextResponse.json({ error: '暂时无法验证视频权限。' }, { status: 503 })
  let allowed = Boolean(assets?.length || published?.length)
  if (!allowed && auth.user) {
    const membership = await auth.supabase.from('organization_members').select('organization_id')
      .eq('organization_id', organizationId).eq('user_id', auth.user.id)
      .eq('status', 'active').in('role', ['owner', 'admin', 'editor']).limit(1)
    if (membership.error) return NextResponse.json({ error: '暂时无法验证视频权限。' }, { status: 503 })
    allowed = Boolean(membership.data?.length)
  }
  if (!allowed) return NextResponse.json({ error: '视频不存在。' }, { status: 404 })
  const { data, error: signError } = await createServiceRoleClient().storage.from(CREATOR_VIDEO_BUCKET).createSignedUrl(path, 60)
  if (signError || !data) return NextResponse.json({ error: '视频暂时不可用。' }, { status: 502 })
  const response = NextResponse.redirect(data.signedUrl, 307)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Referrer-Policy', 'no-referrer')
  return response
}
