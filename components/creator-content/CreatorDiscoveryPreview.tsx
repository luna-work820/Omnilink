'use client'

import { useEffect, useState } from 'react'
import App from '@/components/consumer-market/App'
import { productsList } from '@/components/consumer-market/data/mockData'
import { listLocalPublications } from '@/lib/creator-publications'
import { publicationDefaults, publicationScene, type PublicationDocument } from '@/lib/creator-publication-document'
import type { ScenePost } from '@/components/consumer-market/types'

export function CreatorDiscoveryPreview({ postId }: { postId?: string }) {
  const [posts, setPosts] = useState<ScenePost[] | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    const urls: string[] = []
    const url = (file: File) => { const value = URL.createObjectURL(file); urls.push(value); return value }
    const load = async () => {
      try {
        const records = await listLocalPublications('omnilink-creator-preview-draft')
        const next = records.filter((record) => record.status === 'published' && (record.content.kind === 'article' || record.content.fields.visibility === 'public')).map((record) => {
          const content = record.content
          const document: PublicationDocument = content.kind === 'article'
            ? { version: 1, kind: 'article', fields: { ...publicationDefaults, title: content.article.title }, media: [], coverUrl: content.article.cover?.url ?? '', article: content.article, excerpt: '' }
            : { version: 1, kind: content.kind, fields: content.fields, media: content.media.map(url), coverUrl: content.cover ? url(content.cover) : '', excerpt: content.fields.summary }
          if (!document.coverUrl && document.kind === 'image') document.coverUrl = document.media[0] ?? ''
          return publicationScene(record.id, document, '预览创作者')
        })
        if (alive) { setPosts(next); setError('') }
      } catch { if (alive) setError('内容读取失败，请重试。') }
    }
    void load()
    window.addEventListener('focus', load)
    return () => { alive = false; window.removeEventListener('focus', load); urls.forEach((value) => URL.revokeObjectURL(value)) }
  }, [attempt])
  if (error) return <main className="p-6" role="alert">{error}<button type="button" onClick={() => setAttempt((value) => value + 1)}>重试</button></main>
  if (!posts) return <main className="p-6" role="status">正在读取内容…</main>
  return <App initialProducts={productsList} initialPosts={posts} hasLiveProducts profileName="预览用户" profilePreview initialPostId={postId} />
}
