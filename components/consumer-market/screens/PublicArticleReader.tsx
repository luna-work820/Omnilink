'use client'

import { useRouter } from 'next/navigation'
import type { ScenePost } from '../types'
import { ThemeArticleReader } from './ThemeArticleReader'

export function PublicArticleReader({ post }: { post: ScenePost }) {
  const router = useRouter()
  return <ThemeArticleReader post={post} onClose={() => router.push('/discover')} />
}
