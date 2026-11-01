export type ProductDeliveryType = 'physical' | 'digital' | 'ai_capability'
export type ProductCapabilityKind = 'question_set' | 'skill' | 'plugin'

interface ProductDetailsInput {
  category: string
  categoryId?: string | null
  deliveryType: ProductDeliveryType
  capabilityKind: ProductCapabilityKind
  origin?: string | null
  detailMarkdown?: string
  seoTitle: string
  seoDescription: string
}

export function buildProductDetailsPayload(input: ProductDetailsInput) {
  const detailMarkdown = input.detailMarkdown ?? ''
  const categoryType = input.categoryId ? productTypeFromCategory(input.categoryId) : null
  const deliveryType = categoryType?.deliveryType ?? input.deliveryType
  const capabilityKind = categoryType?.capabilityKind ?? input.capabilityKind

  return {
    category: input.category,
    category_id: input.categoryId || null,
    delivery_type: deliveryType,
    capability_kind: deliveryType === 'ai_capability' ? capabilityKind : null,
    origin: deliveryType === 'physical' ? input.origin?.trim() || null : null,
    detail_content: detailMarkdown,
    detail_content_blocks: { version: 2, format: 'markdown', source: detailMarkdown },
    seo: { title: input.seoTitle, description: input.seoDescription },
  }
}
import { productTypeFromCategory } from './virtual-product-category'

