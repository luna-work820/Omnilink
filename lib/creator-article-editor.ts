'use client'

import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core'
import { createReactBlockSpec } from '@blocknote/react'
import { ArticleProductBlockView, ArticleProductExternalCard } from '@/components/creator-content/ArticleProductBlock'

export const articleProductBlockConfig = {
  type: 'productLink',
  propSchema: {
    url: { default: '' },
    name: { default: '' },
    price: { default: '' },
    image: { default: '' },
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
