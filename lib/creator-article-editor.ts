'use client'

import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import { ArticleProductBlockView, ArticleProductExternalCard } from '@/components/creator-content/ArticleProductBlock'

export const articleProductBlockConfig = {
  type: 'productLink',
  propSchema: {
    kind: { default: 'product', values: ['product', 'shop'] },
    url: { default: '' },
    name: { default: '' },
    price: { default: '' },
    image: { default: '' },
    subtitle: { default: '' },
    gallery: { default: '[]' },
  },
  content: 'none',
} as const

const productLink = createReactBlockSpec(articleProductBlockConfig, {
  render: ArticleProductBlockView,
  toExternalHTML: ArticleProductExternalCard,
})

export const articleSchema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, productLink: productLink() },
})

export type ArticleBlock = typeof articleSchema.PartialBlock

export type ArticleBlockData = {
  type: string
  props?: Record<string, unknown>
  children?: ArticleBlockData[]
  [key: string]: unknown
}

export type GalleryItem = { url: string; name: string; price: string; link: string }

// 兼容两种历史格式：纯 URL 字符串数组、JSON 字符串。统一输出 GalleryItem[]。
export function galleryItems(value: unknown): GalleryItem[] {
  const raw: unknown = typeof value === 'string'
    ? (() => { try { return JSON.parse(value) } catch { return [] } })()
    : value
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 9).map((item): GalleryItem | null => {
    if (typeof item === 'string') return { url: item, name: '', price: '', link: '' }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>
      if (typeof record.url === 'string' && record.url) {
        return {
          url: record.url,
          name: typeof record.name === 'string' ? record.name : '',
          price: typeof record.price === 'string' ? record.price : '',
          link: typeof record.link === 'string' ? record.link : '',
        }
      }
    }
    return null
  }).filter((item): item is GalleryItem => item !== null)
}

export function articleBlocksForEditor(blocks: ArticleBlockData[]): ArticleBlock[] {
  return blocks.map((block) => {
    const next: ArticleBlockData = { ...block }
    if (Array.isArray(block.children)) next.children = articleBlocksForEditor(block.children) as unknown as ArticleBlockData[]
    if (block.type === 'productLink') {
      const props = block.props ?? {}
      next.props = { ...props, gallery: JSON.stringify(galleryItems(props.gallery)) }
    }
    return next
  }) as unknown as ArticleBlock[]
}

export function articleBlocksFromEditor(blocks: ArticleBlock[]): ArticleBlockData[] {
  return blocks.map((block) => {
    const source = block as unknown as ArticleBlockData
    const next: ArticleBlockData = { ...source }
    if (Array.isArray(source.children)) next.children = articleBlocksFromEditor(source.children as ArticleBlock[])
    if (source.type === 'productLink') {
      const props = source.props ?? {}
      next.props = { ...props, gallery: galleryItems(props.gallery) }
    }
    return next
  })
}
