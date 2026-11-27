import { articlePublication, publicationValidation } from '@/lib/creator-publication-document'
import { archiveLocalPublication, getLocalPublication, saveLocalPublication } from '@/lib/creator-publications'
import { readRemotePublication, saveRemotePublication, uploadArticleImages } from '@/lib/creator-publication-client'

export async function publishManagedArticle({ id, ownerKey, local, previewMode }: { id: string; ownerKey: string; local: boolean; previewMode: boolean }) {
  if (local) {
    const record = await getLocalPublication(ownerKey, id)
    if (!record || record.status === 'archived' || record.status === 'scheduled') throw new Error('文章不可发布，请刷新后重试。')
    if (previewMode && record.status === 'published' && !record.pending) throw new Error('文章没有待发布的修改。')
    const content = record.pending ?? record.content
    if (content.kind !== 'article') throw new Error('内容不是文章。')
    const validation = publicationValidation(articlePublication(content.article), 'published')
    if (validation) throw new Error(validation)
    if (previewMode) {
      await saveLocalPublication(ownerKey, content, 'published', id)
      return { localCleanupFailed: false }
    }
    const uploaded = await uploadArticleImages(content.article, new Map())
    await saveRemotePublication(articlePublication(uploaded), 'published')
    try { await archiveLocalPublication(ownerKey, id) }
    catch { return { localCleanupFailed: true } }
    return { localCleanupFailed: false }
  }

  const record = await readRemotePublication(id)
  if (record.status === 'archived' || record.status === 'scheduled') throw new Error('文章不可发布，请刷新后重试。')
  if (record.status === 'published' && !record.pending) throw new Error('文章没有待发布的修改。')
  const document = record.pending ?? record.content
  if (document.kind !== 'article') throw new Error('内容不是文章。')
  const validation = publicationValidation(document, 'published')
  if (validation) throw new Error(validation)
  await saveRemotePublication(document, 'published', id)
  return { localCleanupFailed: false }
}
