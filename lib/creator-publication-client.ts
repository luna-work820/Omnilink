'use client'

import { createBrowserClient } from '@supabase/ssr'
import { CREATOR_MEDIA_BUCKET, type PublicationDocument, type RemotePublication } from '@/lib/creator-publication-document'
import type { PublicationStatus } from '@/lib/creator-publications'

export async function uploadCreatorFile(file: File): Promise<string> {
  const inferred = /\.webp$/i.test(file.name) ? 'image/webp' : /\.png$/i.test(file.name) ? 'image/png' : /\.jpe?g$/i.test(file.name) ? 'image/jpeg' : /\.webm$/i.test(file.name) ? 'video/webm' : 'video/mp4'
  const contentType = file.type || inferred
  const response = await fetch('/api/creator-posts/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType, size: file.size }) })
  const ticket = await response.json()
  if (!response.ok) throw new Error(ticket.error || '素材上传失败。')
  const client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.storage.from(CREATOR_MEDIA_BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType })
  if (error) throw new Error('素材上传失败，请重试。')
  return ticket.url
}
export async function uploadArticleImages<T>(value: T, cache: Map<string, string>): Promise<T> {
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    if (cache.has(value)) return cache.get(value) as T
    const response = await fetch(value)
    const blob = await response.blob()
    const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    const url = await uploadCreatorFile(new File([blob], `article.${extension}`, { type: blob.type }))
    cache.set(value, url)
    return url as T
  }
  if (Array.isArray(value)) {
    const values = []
    for (const item of value) values.push(await uploadArticleImages(item, cache))
    return values as T
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) next[key] = await uploadArticleImages(item, cache)
    return next as T
  }
  return value
}
export async function readRemotePublication(id: string): Promise<RemotePublication> {
  const response = await fetch(`/api/creator-publications?id=${encodeURIComponent(id)}`, { cache: 'no-store' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '内容读取失败。')
  return result.record
}
export async function saveRemotePublication(document: PublicationDocument, status: Exclude<PublicationStatus, 'archived'>, id?: string): Promise<RemotePublication> {
  const response = await fetch('/api/creator-publications', { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, document, status }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '发布失败，请重试。')
  return result.record
}
export async function archiveRemotePublication(id: string, restore = false) {
  const response = await fetch('/api/creator-publications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: restore ? 'restore' : 'archive' }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '操作失败，请重试。')
}
