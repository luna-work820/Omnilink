import { describe, expect, it } from 'vitest'
import { contentProductIds, parseCreatorPostInput, readContentBlocks, validContentVideoUrl, validateCreatorPostPublication, type CreatorPostInput } from './creator-content'

const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const product = (id: string, status = 'active', url = 'https://www.xiaohongshu.com/explore/item') => ({
  id, status, details: { outbound_links: { xiaohongshu: url } },
})
const base: CreatorPostInput = {
  title: '工作桌搭配', coverUrl: 'https://example.com/cover.jpg', status: 'published',
  blocks: [
    { id: 'intro', type: 'text', text: '两件适合一起使用的作品。' },
    { id: 'products', type: 'group', productIds: [a, b] },
  ],
}

describe('creator content blocks', () => {
  it('requires linked products to be live, visible and linked externally', () => {
    expect(validateCreatorPostPublication(base, [product(a), product(b)], new Set([a, b]))).toBeNull()
    expect(validateCreatorPostPublication(base, [product(a), product(b, 'draft')], new Set([a, b]))).not.toBeNull()
    expect(validateCreatorPostPublication(base, [product(a), product(b)], new Set([a]))).not.toBeNull()
    expect(validateCreatorPostPublication(base, [product(a), product(b, 'active', 'https://example.com')], new Set([a, b]))).not.toBeNull()
  })

  it('accepts a product-only composition and rejects invalid blocks', () => {
    expect(validateCreatorPostPublication({ ...base, blocks: [{ id: 'one', type: 'product', productIds: [a] }] }, [product(a)], new Set([a]))).toBeNull()
    expect(parseCreatorPostInput({ ...base, blocks: [{ id: 'bad', type: 'product', productIds: [a, b] }] })).toBeNull()
    expect(parseCreatorPostInput({ ...base, blocks: [{ id: 'bad', type: 'image', url: 'javascript:alert(1)' }] })).toBeNull()
  })

  it('keeps old text and product ordering readable', () => {
    const blocks = readContentBlocks([], '旧笔记', [a, b])
    expect(blocks.map((block) => block.type)).toEqual(['text', 'group'])
    expect(contentProductIds(blocks)).toEqual([a, b])
  })

  it('accepts direct MP4 and WebM videos, but rejects unsafe or non-video URLs', () => {
    expect(validContentVideoUrl('https://cdn.example.com/story.mp4?token=abc')).toBe(true)
    expect(validContentVideoUrl('https://cdn.example.com/story.webm')).toBe(true)
    expect(validContentVideoUrl('javascript:alert(1)')).toBe(false)
    expect(validContentVideoUrl('https://example.com/story.html')).toBe(false)
    expect(parseCreatorPostInput({ ...base, blocks: [{ id: 'video', type: 'video', url: 'https://example.com/story.mp4' }] })).not.toBeNull()
    expect(parseCreatorPostInput({ ...base, blocks: [{ id: 'video', type: 'video', url: 'https://example.com/story.html' }] })).toBeNull()
  })

  it('does not publish a video block until a playable URL is attached', () => {
    const videoPost = { ...base, blocks: [{ id: 'video', type: 'video' as const, url: '' }, ...base.blocks] }
    expect(validateCreatorPostPublication(videoPost, [product(a), product(b)], new Set([a, b]))).toContain('视频上传')
    expect(validateCreatorPostPublication({ ...videoPost, blocks: [{ id: 'video', type: 'video', url: 'https://cdn.example.com/story.mp4' }, ...base.blocks] }, [product(a), product(b)], new Set([a, b]))).toBeNull()
  })
})
