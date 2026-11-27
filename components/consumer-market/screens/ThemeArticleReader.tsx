'use client'

import { X } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { ScenePost } from '../types'

const ArticlePhonePreview = dynamic(() => import('@/components/creator-content/ArticlePhonePreview').then((module) => module.ArticlePhonePreview), {
  ssr: false,
  loading: () => <p className="py-6 text-sm text-[var(--text-secondary)]" role="status">正在读取文章…</p>,
})

// 主题文章预览和公开阅读共用同一套文章与店铺卡片渲染。
export function ThemeArticleReader({ post, onClose }: { post: ScenePost; onClose: () => void }) {
  const article = post.publication?.kind === 'article' ? post.publication.article : null
  if (!article) return null

  return (
    <div role="dialog" aria-modal="true" aria-label={post.title} className="fixed inset-0 z-50 overflow-y-auto bg-[var(--canvas)] text-[var(--text-primary)]">
      <div className="mx-auto max-w-2xl pb-16">
        <div className="sticky top-0 z-10 flex h-14 items-center justify-between bg-[var(--canvas)] px-4">
          <span className="text-sm">{post.editorName}</span>
          <button type="button" autoFocus onClick={onClose} aria-label="关闭内容" className="grid size-10 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--interactive-hover)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]"><X size={20} aria-hidden="true" /></button>
        </div>

        <div className="px-4 sm:px-6">
          <ArticlePhonePreview draft={article} frame={false} />
        </div>
      </div>
    </div>
  )
}
