import type { ArticleDraft } from '@/lib/creator-article-draft'
import { openCreatorDatabase } from '@/lib/creator-local-db'

export type PublicationKind = 'video' | 'image' | 'article'
export type PublicationStatus = 'published' | 'draft' | 'scheduled' | 'archived'
export type PublicationFields = {
  title: string; summary: string; topics: string; collection: string; declaration: string; location: string
  visibility: 'public' | 'friends' | 'private'; allowSave: boolean; timing: 'now' | 'scheduled'; scheduledAt: string
}
export type PublicationContent =
  | { kind: 'video' | 'image'; fields: PublicationFields; media: File[]; cover: File | null }
  | { kind: 'article'; article: ArticleDraft }
export type LocalPublication = {
  id: string; ownerKey: string; content: PublicationContent; status: PublicationStatus
  createdAt: number; updatedAt: number; publishedAt: number | null
  pending?: PublicationContent; archivedFrom?: Exclude<PublicationStatus, 'archived'>
}

export function publicationTitle(content: PublicationContent) {
  return content.kind === 'article' ? content.article.title : content.fields.title
}

async function writeRecord(record: LocalPublication) {
  const database = await openCreatorDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('publications', 'readwrite')
    transaction.objectStore('publications').put(record, record.id)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}

export async function getLocalPublication(ownerKey: string, id: string): Promise<LocalPublication | null> {
  const database = await openCreatorDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('publications', 'readonly')
    const request = transaction.objectStore('publications').get(id)
    transaction.oncomplete = () => { database.close(); const record = request.result as LocalPublication | undefined; resolve(record?.ownerKey === ownerKey ? record : null) }
    transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}

export async function listLocalPublications(ownerKey: string): Promise<LocalPublication[]> {
  const database = await openCreatorDatabase()
  const records = await new Promise<LocalPublication[]>((resolve, reject) => {
    const transaction = database.transaction('publications', 'readonly')
    const request = transaction.objectStore('publications').getAll()
    transaction.oncomplete = () => { database.close(); resolve((request.result as LocalPublication[]).filter((record) => record.ownerKey === ownerKey)) }
    transaction.onabort = transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
  for (const record of records) {
    if (record.status === 'scheduled' && record.content.kind !== 'article' && new Date(record.content.fields.scheduledAt).getTime() <= Date.now()) {
      record.status = 'published'
      record.publishedAt = Date.now()
      await writeRecord(record)
    }
  }
  return records.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveLocalPublication(ownerKey: string, content: PublicationContent, status: Exclude<PublicationStatus, 'archived'>, id?: string): Promise<LocalPublication> {
  const previous = id ? await getLocalPublication(ownerKey, id) : null
  const now = Date.now()
  const record: LocalPublication = previous?.status === 'published' && status === 'draft'
    ? { ...previous, pending: content, updatedAt: now }
    : { id: previous?.id ?? crypto.randomUUID(), ownerKey, content, status, createdAt: previous?.createdAt ?? now, updatedAt: now, publishedAt: status === 'published' ? previous?.publishedAt ?? now : null }
  await writeRecord(record)
  return record
}

export async function archiveLocalPublication(ownerKey: string, id: string, restore = false) {
  const record = await getLocalPublication(ownerKey, id)
  if (!record) throw new Error('内容不存在，请刷新后重试。')
  if (restore) { record.status = record.archivedFrom ?? 'draft'; delete record.archivedFrom }
  else { if (record.status === 'archived') return; record.archivedFrom = record.status; record.status = 'archived' }
  record.updatedAt = Date.now()
  await writeRecord(record)
}
