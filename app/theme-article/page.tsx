'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeArticleReader } from '@/components/consumer-market/screens/ThemeArticleReader'
import { GILDED_EAST_POST_ID } from '@/components/consumer-market/data/theme-article-demo'
import type { ScenePost } from '@/components/consumer-market/types'
import { articlePublication, publicationScene } from '@/lib/creator-publication-document'
import { CREATOR_PREVIEW_OWNER_KEY, ensureCreatorPreviewSample, refreshCreatorPreviewSample } from '@/lib/creator-preview-sample'
import { getLocalPublication } from '@/lib/creator-publications'

// dev-only 主题文章预览页，生产环境不可访问。?refresh=1 用最新样例覆盖本机记录。
export default function ThemeArticlePage() {
  const router = useRouter()
  const [post, setPost] = useState<ScenePost | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    let active = true
    let loadSequence = 0
    const load = async () => {
      const sequence = ++loadSequence
      try {
        if (new URLSearchParams(window.location.search).get('refresh') === '1') await refreshCreatorPreviewSample()
        await ensureCreatorPreviewSample()
        const record = await getLocalPublication(CREATOR_PREVIEW_OWNER_KEY, GILDED_EAST_POST_ID)
        if (!record || record.status !== 'published' || record.content.kind !== 'article') {
          if (active && sequence === loadSequence) { setPost(null); setError('内容不存在或已取消公开。') }
          return
        }
        if (active && sequence === loadSequence) { setPost(publicationScene(record.id, articlePublication(record.content.article), '预览创作者')); setError('') }
      } catch { if (active && sequence === loadSequence) { setPost(null); setError('本机内容读取失败，请刷新重试。') } }
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') void load() }
    void load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => { active = false; window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', refreshVisible) }
  }, [])
  if (process.env.NODE_ENV === 'production') return null
  function closePreview() {
    const previousUrl = document.referrer
    if (window.history.length > 1 && previousUrl && new URL(previousUrl).origin === window.location.origin) {
      router.back()
      return
    }
    router.push('/discover?creatorPreview=1')
  }
  if (error) return <p role="alert">{error}</p>
  if (!post) return <p role="status">正在读取文章…</p>
  return <ThemeArticleReader post={post} onClose={closePreview} />
}
