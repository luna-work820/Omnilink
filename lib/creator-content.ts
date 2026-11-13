import { readOutboundLinks } from '@/lib/products/outbound-links'
import { creatorVideoPath } from '@/lib/creator-video'

export type ContentBlock =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; url: string }
  | { id: string; type: 'video'; url: string }
  | { id: string; type: 'product'; productIds: string[] }
  | { id: string; type: 'group'; productIds: string[] }

export type CreatorPostStatus = 'draft' | 'published'

export interface CreatorPostInput {
  title: string
  coverUrl: string
  blocks: ContentBlock[]
  status: CreatorPostStatus
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validContentImageUrl(value: string): boolean {
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function validContentVideoUrl(value: string): boolean {
  if (creatorVideoPath(value)) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname) && /\.(mp4|webm)$/i.test(url.pathname)
  } catch {
    return false
  }
}

export function contentProductIds(blocks: ContentBlock[]): string[] {
  return [...new Set(blocks.flatMap((block) => block.type === 'product' || block.type === 'group' ? block.productIds : []))]
}

export function contentExcerpt(blocks: ContentBlock[]): string {
  return blocks.filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text.trim()).filter(Boolean).join('\n\n').slice(0, 5000)
}

export function legacyContentBlocks(body: string, productIds: string[]): ContentBlock[] {
  const blocks: ContentBlock[] = body ? [{ id: 'legacy-text', type: 'text', text: body }] : []
  if (productIds.length) blocks.push({ id: 'legacy-products', type: productIds.length === 1 ? 'product' : 'group', productIds })
  return blocks
}

export function readContentBlocks(value: unknown, body = '', productIds: string[] = []): ContentBlock[] {
  if (!Array.isArray(value) || !value.length) return legacyContentBlocks(body, productIds)
  return parseBlocks(value) ?? legacyContentBlocks(body, productIds)
}

function parseBlocks(value: unknown): ContentBlock[] | null {
  if (!Array.isArray(value) || value.length > 80) return null
  const ids = new Set<string>()
  const blocks: ContentBlock[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const block = item as Record<string, unknown>
    if (typeof block.id !== 'string' || !block.id || block.id.length > 80 || ids.has(block.id)) return null
    ids.add(block.id)
    if (block.type === 'text' && typeof block.text === 'string' && block.text.length <= 5000) {
      blocks.push({ id: block.id, type: 'text', text: block.text })
    } else if (block.type === 'image' && typeof block.url === 'string' && block.url.length <= 2048 && (!block.url || validContentImageUrl(block.url))) {
      blocks.push({ id: block.id, type: 'image', url: block.url })
    } else if (block.type === 'video' && typeof block.url === 'string' && block.url.length <= 2048 && (!block.url || validContentVideoUrl(block.url))) {
      blocks.push({ id: block.id, type: 'video', url: block.url })
    } else if ((block.type === 'product' || block.type === 'group') && Array.isArray(block.productIds) &&
      block.productIds.length <= (block.type === 'product' ? 1 : 6) && block.productIds.every((id) => typeof id === 'string' && uuid.test(id)) &&
      new Set(block.productIds).size === block.productIds.length) {
      blocks.push({ id: block.id, type: block.type, productIds: block.productIds })
    } else return null
  }
  const textLength = blocks.reduce((total, block) => total + (block.type === 'text' ? block.text.length : 0), 0)
  if (textLength > 5000 || contentProductIds(blocks).length > 30) return null
  return blocks
}

export function parseCreatorPostInput(value: unknown): CreatorPostInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (input.status !== 'draft' && input.status !== 'published') return null
  if (typeof input.title !== 'string' || typeof input.coverUrl !== 'string') return null
  const title = input.title.trim()
  const coverUrl = input.coverUrl.trim()
  const blocks = parseBlocks(input.blocks)
  if (!blocks || title.length > 100 || coverUrl.length > 2048 || (coverUrl && !validContentImageUrl(coverUrl))) return null
  return { title, coverUrl, blocks, status: input.status }
}

export function validateCreatorPostPublication(
  post: CreatorPostInput,
  products: Array<{ id: string; status: string; details: unknown }>,
  visibleIds: Set<string>,
): string | null {
  if (post.status !== 'published') return null
  if (!post.title || !post.coverUrl) return '发布前请填写标题和封面'
  if (post.blocks.some((block) => block.type === 'video' && !block.url)) return '请完成视频上传，或移除未完成的视频块'
  const ids = contentProductIds(post.blocks)
  if (!ids.length) return '发布前请添加至少一件商品'
  if (products.length !== ids.length) return '部分商品不存在或不属于当前工作台'
  for (const product of products) {
    const details = product.details && typeof product.details === 'object' && !Array.isArray(product.details)
      ? product.details as Record<string, unknown> : {}
    if (product.status !== 'active' || !visibleIds.has(product.id) || !Object.keys(readOutboundLinks(details.outbound_links)).length) {
      return '关联商品须先发布到发现页，并设置有效的外部链接'
    }
  }
  return null
}
