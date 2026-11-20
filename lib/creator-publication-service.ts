import { getOwnedStore } from '@/lib/api/auth'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { CREATOR_MEDIA_BUCKET, creatorMediaTypes, publicationAssetPaths, type PublicationDocument } from '@/lib/creator-publication-document'
import type { AuthResult } from '@/lib/api/auth'

export async function creatorPublicationStore(auth: Extract<AuthResult, { ok: true }>) {
  const owned = await getOwnedStore(auth.supabase, auth.user)
  if (!owned) return null
  const { data, error } = await auth.supabase.from('stores').select('id,organization_id').eq('id', owned.id).maybeSingle()
  if (error) throw new Error('发布空间读取失败。')
  return data as { id: string; organization_id: string } | null
}

export async function verifyPublicationAssets(document: PublicationDocument, organizationId: string) {
  const paths = publicationAssetPaths(document)
  if (paths.length > 64) throw new Error('素材过多，最多支持 64 个上传文件。')
  if (paths.some((path) => !path.startsWith(`${organizationId}/`))) throw new Error('素材不属于当前发布空间。')
  const storage = paths.length ? createServiceRoleClient().storage.from(CREATOR_MEDIA_BUCKET) : null
  for (let index = 0; index < paths.length; index += 5) {
    await Promise.all(paths.slice(index, index + 5).map(async (path) => {
      const { data, error } = await storage!.info(path)
      if (error || !data) throw new Error('素材上传未完成，请重试。')
      const max = /\.(mp4|webm)$/i.test(path) ? creatorMediaTypes['video/mp4'].maxBytes : creatorMediaTypes['image/jpeg'].maxBytes
      if (typeof data.size !== 'number' || !Number.isFinite(data.size) || data.size <= 0 || data.size > max) throw new Error('素材大小超出限制。')
    }))
  }
  return paths
}
