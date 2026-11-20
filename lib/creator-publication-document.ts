import type { ArticleDraft } from '@/lib/creator-article-draft'
import type { PublicationFields, PublicationKind, PublicationStatus } from '@/lib/creator-publications'
import { articleBackgrounds } from '@/lib/creator-article-backgrounds'
import type { ScenePost } from '@/components/consumer-market/types'

export type PublicationDocument = {
  version: 1
  kind: PublicationKind
  fields: PublicationFields
  media: string[]
  coverUrl: string
  article?: ArticleDraft
  excerpt: string
}
export type RemotePublication = {
  id: string; content: PublicationDocument; pending?: PublicationDocument
  status: PublicationStatus; createdAt: number; updatedAt: number; publishedAt: number | null
  scheduledAt: string | null
}
export function publicationScene(id: string, document: PublicationDocument, author: string): ScenePost {
  return { id, kind: 'note', title: document.fields.title, editorName: author, editorAvatar: '', coverImage: document.coverUrl,
    isVideo: document.kind === 'video', mediaList: document.media, linkedProducts: [], aspectRatio: document.kind === 'video' ? 3 / 4 : 4 / 3,
    description: document.excerpt, publication: document }
}
export const publicationDefaults: PublicationFields = {
  title: '', summary: '', topics: '', collection: '', declaration: '', location: '',
  visibility: 'public', allowSave: true, timing: 'now', scheduledAt: '',
}
export const CREATOR_MEDIA_BUCKET = 'creator-content-videos'
export const CREATOR_MEDIA_PREFIX = '/api/creator-posts/media/'
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const mediaPattern = new RegExp(`^${uuid}/${uuid}/${uuid}\\.(mp4|webm|jpg|jpeg|png|webp)$`, 'i')
export function creatorMediaPath(url: string): string | null {
  const path = url.startsWith(CREATOR_MEDIA_PREFIX) ? url.slice(CREATOR_MEDIA_PREFIX.length) : ''
  return mediaPattern.test(path) ? path : null
}
export function creatorMediaUrl(path: string) {
  if (!mediaPattern.test(path)) throw new Error('素材路径无效。')
  return `${CREATOR_MEDIA_PREFIX}${path}`
}
export const creatorMediaTypes: Record<string, { extension: string; maxBytes: number }> = {
  'video/mp4': { extension: 'mp4', maxBytes: 100 * 1024 * 1024 },
  'video/webm': { extension: 'webm', maxBytes: 100 * 1024 * 1024 },
  'image/jpeg': { extension: 'jpg', maxBytes: 5 * 1024 * 1024 },
  'image/png': { extension: 'png', maxBytes: 5 * 1024 * 1024 },
  'image/webp': { extension: 'webp', maxBytes: 5 * 1024 * 1024 },
}
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function imageUrl(value: unknown, empty = false): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  if (!value) return empty
  if (creatorMediaPath(value)) return true
  if (/^\/consumer-market\/[\w/.-]+\.(webp|png|jpe?g)$/i.test(value)) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}
const articleTypes = new Set(['paragraph', 'heading', 'bulletListItem', 'numberedListItem', 'checkListItem', 'quote', 'divider', 'image', 'table', 'codeBlock', 'toggleListItem', 'productLink'])
function validateArticle(blocks: unknown): blocks is ArticleDraft['blocks'] {
  if (!Array.isArray(blocks) || blocks.length > 500) return false
  let count = 0
  function visit(value: unknown, depth: number): boolean {
    if (depth > 20 || ++count > 20000) return false
    if (Array.isArray(value)) return value.every((item) => visit(item, depth + 1))
    if (!object(value)) return typeof value !== 'string' || value.length <= 100000
    if (typeof value.type === 'string' && !articleTypes.has(value.type) && !['text', 'link', 'tableContent', 'tableCell'].includes(value.type)) return false
    if (value.type === 'text' && (typeof value.text !== 'string' || value.styles !== undefined && !object(value.styles))) return false
    if (value.type === 'productLink' && value.props !== undefined && (!object(value.props) || ['url', 'name', 'price', 'image'].some((key) => value.props && typeof (value.props as Record<string, unknown>)[key] !== 'string'))) return false
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return false
      if (['url', 'href', 'image', 'src'].includes(key) && child && !imageUrl(child)) {
        if (key !== 'href' && key !== 'url') return false
        try { const url = new URL(String(child)); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return false } catch { return false }
      }
      if (!visit(child, depth + 1)) return false
    }
    return true
  }
  function blockTree(items: unknown[], depth: number): boolean {
    return depth < 10 && items.every((block) => object(block) && typeof block.type === 'string' && articleTypes.has(block.type)
      && (!block.children || Array.isArray(block.children) && blockTree(block.children, depth + 1)))
  }
  return blockTree(blocks, 0) && visit(blocks, 0)
}
export function articleExcerpt(blocks: unknown): string {
  const parts: string[] = []
  function visit(value: unknown) {
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (!object(value)) return
    if (value.type === 'text' && typeof value.text === 'string') parts.push(value.text)
    if (value.content) visit(value.content)
    if (value.children) visit(value.children)
    if (value.rows) visit(value.rows)
    if (value.cells) visit(value.cells)
  }
  visit(blocks)
  return parts.join('\n').slice(0, 5000)
}
export function parsePublicationDocument(value: unknown): PublicationDocument | null {
  if (!object(value) || value.version !== 1 || !['video', 'image', 'article'].includes(String(value.kind)) || !object(value.fields)) return null
  if (JSON.stringify(value).length > 1000000) return null
  const source = value.fields
  const fields = { ...publicationDefaults } as PublicationFields
  for (const [key, max] of Object.entries({ title: 100, summary: 1000, topics: 300, collection: 100, declaration: 40, location: 200, scheduledAt: 40 })) {
    if (typeof source[key] !== 'string' || source[key].length > max) return null
    Object.assign(fields, { [key]: source[key].trim() })
  }
  if (!['public', 'private'].includes(String(source.visibility)) || typeof source.allowSave !== 'boolean' || !['now', 'scheduled'].includes(String(source.timing))) return null
  fields.visibility = source.visibility as PublicationFields['visibility']; fields.allowSave = source.allowSave; fields.timing = source.timing as PublicationFields['timing']
  if (!imageUrl(value.coverUrl, true) || !Array.isArray(value.media) || value.media.length > 9 || !value.media.every((url) => imageUrl(url))) return null
  if (/\.(mp4|webm)$/i.test(value.coverUrl)) return null
  const document: PublicationDocument = { version: 1, kind: value.kind as PublicationKind, fields, media: value.media, coverUrl: value.coverUrl, excerpt: fields.summary }
  if (document.kind === 'video' && (document.media.length > 1 || document.media.some((url) => !/\.(mp4|webm)$/i.test(url)))) return null
  if (document.kind === 'image' && document.media.some((url) => /\.(mp4|webm)$/i.test(url))) return null
  if (document.kind === 'article') {
    const article = value.article
    if (!object(article) || article.version !== 2 || typeof article.title !== 'string' || article.title.trim() !== fields.title || !articleBackgrounds.some((bg) => bg.id === article.background) || !validateArticle(article.blocks)) return null
    if (article.cover !== null && (!object(article.cover) || !imageUrl(article.cover.url) || typeof article.cover.position !== 'number' || article.cover.position < 0 || article.cover.position > 100)) return null
    document.article = article as ArticleDraft
    document.excerpt = articleExcerpt(article.blocks)
    if ((document.article.cover?.url ?? '') !== document.coverUrl) return null
  }
  return document
}
export function publicationValidation(document: PublicationDocument, status: string) {
  if (!['draft', 'published', 'scheduled'].includes(status)) return '发布状态无效。'
  if (status === 'draft') return null
  if (!document.fields.title || !document.coverUrl) return '请填写标题并添加封面。'
  if (document.kind !== 'article' && !document.media.length) return '请添加发布素材。'
  if (document.kind === 'article' && !document.article?.blocks.some((block) => block.type !== 'paragraph' || articleExcerpt([block]).trim())) return '请填写文章正文。'
  if (status === 'scheduled' && (!Number.isFinite(Date.parse(document.fields.scheduledAt)) || Date.parse(document.fields.scheduledAt) <= Date.now())) return '请选择将来的发布时间。'
  return null
}
export function publicationAssetPaths(document: PublicationDocument): string[] {
  const paths = new Set<string>()
  function visit(value: unknown) {
    if (typeof value === 'string') { const path = creatorMediaPath(value); if (path) paths.add(path) }
    else if (Array.isArray(value)) value.forEach(visit)
    else if (object(value)) Object.values(value).forEach(visit)
  }
  visit(document)
  return [...paths]
}
export function remotePublication(row: unknown): RemotePublication | null {
  if (!object(row)) return null
  const content = parsePublicationDocument(row.publication)
  if (!content || typeof row.id !== 'string') return null
  const pending = object(row.draft_version) ? parsePublicationDocument(row.draft_version.publication) : null
  return { id: row.id, content, ...(pending ? { pending } : {}), status: row.status as PublicationStatus, createdAt: Date.parse(String(row.created_at)), updatedAt: Date.parse(String(row.updated_at)), publishedAt: row.published_at ? Date.parse(String(row.published_at)) : null, scheduledAt: typeof row.scheduled_at === 'string' ? row.scheduled_at : null }
}
