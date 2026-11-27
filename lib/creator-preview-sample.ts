import { GILDED_EAST_POST_ID, LEGACY_GILDED_EAST_POST_ID, gildedEastArticle } from '@/components/consumer-market/data/theme-article-demo'
import { openCreatorDatabase } from '@/lib/creator-local-db'
import type { LocalPublication } from '@/lib/creator-publications'

export const CREATOR_PREVIEW_OWNER_KEY = 'omnilink-creator-preview-draft'

export function previewPublicationId(id: string | undefined) {
  return id === LEGACY_GILDED_EAST_POST_ID ? GILDED_EAST_POST_ID : id
}

// 用最新代码里的样例覆盖本机预览记录（dev-only 刷新入口用）。
export async function refreshCreatorPreviewSample(): Promise<void> {
  const database = await openCreatorDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('publications', 'readwrite')
    const store = transaction.objectStore('publications')
    const now = Date.now()
    const record: LocalPublication = {
      id: GILDED_EAST_POST_ID,
      ownerKey: CREATOR_PREVIEW_OWNER_KEY,
      content: { kind: 'article', article: gildedEastArticle },
      status: 'published',
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    }
    store.put(record, record.id)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('本机预览数据无法更新。')) }
  })
}

export async function ensureCreatorPreviewSample(): Promise<void> {
  const database = await openCreatorDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('publications', 'readwrite')
    const store = transaction.objectStore('publications')
    const request = store.get(GILDED_EAST_POST_ID)
    request.onsuccess = () => {
      const existing = request.result as LocalPublication | undefined
      if (existing) {
        if (existing.ownerKey !== CREATOR_PREVIEW_OWNER_KEY) transaction.abort()
        return
      }
      const now = Date.now()
      const record: LocalPublication = {
        id: GILDED_EAST_POST_ID,
        ownerKey: CREATOR_PREVIEW_OWNER_KEY,
        content: { kind: 'article', article: gildedEastArticle },
        status: 'published',
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      }
      store.add(record, record.id)
    }
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('本机预览数据无法读取。')) }
  })
}
