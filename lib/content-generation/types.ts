export type ContentChannel = 'douyin' | 'xiaohongshu' | 'detail-page'

export type ProductSemanticDraft = {
  productName: string
  material: string[]
  colors: string[]
  structure: string[]
  functions: string[]
  audience: string[]
  sellingPoints: string[]
  claimsNeedingEvidence: string[]
}

export type GeneratedImage = {
  id: string
  dataUrl: string
  kind: 'generated' | 'source-preview'
  aspectRatio: '1:1' | '4:5'
}

export type ChannelCopy = {
  channel: ContentChannel
  title: string
  body: string
  hashtags: string[]
  cta: string
}

export type ContentGenerationResponse = {
  semantics: ProductSemanticDraft
  images: GeneratedImage[]
  copy: ChannelCopy[]
  notices: string[]
}
