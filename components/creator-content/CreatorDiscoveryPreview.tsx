'use client'

import { useEffect, useState } from 'react'
import App from '@/components/consumer-market/App'
import { productsList } from '@/components/consumer-market/data/mockData'
import { listLocalPublications } from '@/lib/creator-publications'
import { articlePublication, publicationScene, type PublicationDocument } from '@/lib/creator-publication-document'
import { CREATOR_PREVIEW_OWNER_KEY, ensureCreatorPreviewSample, previewPublicationId } from '@/lib/creator-preview-sample'
import type { ProductItem, ScenePost } from '@/components/consumer-market/types'

export function CreatorDiscoveryPreview({ postId, initialProducts = productsList }: { postId?: string; initialProducts?: ProductItem[] }) {
  const [posts, setPosts] = useState<ScenePost[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    let loadSequence = 0
    const urls: string[] = []
    const url = (file: File) => { const value = URL.createObjectURL(file); urls.push(value); return value }
    const load = async () => {
      const sequence = ++loadSequence
      try {
        await ensureCreatorPreviewSample()
        const records = await listLocalPublications(CREATOR_PREVIEW_OWNER_KEY)
        const next = records.filter((record) => record.status === 'published' && (record.content.kind === 'article' || record.content.fields.visibility === 'public')).map((record) => {
          const content = record.content
          const document: PublicationDocument = content.kind === 'article'
            ? articlePublication(content.article)
            : { version: 1, kind: content.kind, fields: content.fields, media: content.media.map(url), coverUrl: content.cover ? url(content.cover) : '', excerpt: content.fields.summary }
          if (!document.coverUrl && document.kind === 'image') document.coverUrl = document.media[0] ?? ''
          return { ...publicationScene(record.id, document, '预览创作者'), href: `/discover?creatorPreview=1&post=${encodeURIComponent(record.id)}` }
        })
        if (alive && sequence === loadSequence) { setPosts(next); setError('') }
      } catch { if (alive && sequence === loadSequence) setError('内容读取失败，请重试。') }
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => { alive = false; window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', refreshVisible); urls.forEach((value) => URL.revokeObjectURL(value)) }
  }, [attempt])
  if (error) return <main className="p-6" role="alert">{error}<button type="button" onClick={() => setAttempt((value) => value + 1)}>重试</button></main>
  if (!posts) return <main className="p-6" role="status">正在读取内容…</main>
  return <App initialProducts={initialProducts} initialPosts={posts} hasLiveProducts profileName="预览用户" profilePreview initialPostId={previewPublicationId(postId)} />
}
