import type { ArticleBlock } from '@/lib/creator-article-editor'
import { articleBackgrounds } from '@/lib/creator-article-backgrounds'
import { openCreatorDatabase } from '@/lib/creator-local-db'

export type ArticleDraft = {
  version: 2
  title: string
  background: string
  cover: { url: string; position: number } | null
  blocks: ArticleBlock[]
  updatedAt: number
}

const storeName = 'article-drafts'

export async function readArticleDraft(key: string): Promise<ArticleDraft | null> {
  const database = await openCreatorDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(key)
    transaction.oncomplete = () => {
      database.close()
      const draft = request.result as (Omit<ArticleDraft, 'version'> & { version: number }) | undefined
      if (!draft) return resolve(null)
      if (![1, 2].includes(draft.version) || typeof draft.title !== 'string' || !Array.isArray(draft.blocks)) {
        return reject(new Error('文章草稿格式无法读取'))
      }
      const legacyBackgrounds: Record<string, string> = { white: 'white', gray: 'gray-2', sand: 'yellow-2', blue: 'blue-2' }
      const background = legacyBackgrounds[draft.background] ?? draft.background
      if (!articleBackgrounds.some((item) => item.id === background)) return reject(new Error('文章背景格式无法读取'))
      const cover = draft.cover
      resolve({ ...draft, version: 2, background, cover: cover && typeof cover.url === 'string' ? { url: cover.url, position: Number.isFinite(cover.position) ? Math.min(100, Math.max(0, cover.position)) : 50 } : null })
    }
    transaction.onabort = () => { database.close(); reject(transaction.error) }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}

export async function writeArticleDraft(key: string, draft: ArticleDraft): Promise<void> {
  const database = await openCreatorDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(draft, key)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onabort = () => { database.close(); reject(transaction.error) }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}
