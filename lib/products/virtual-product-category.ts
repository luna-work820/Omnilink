import type { ProductCapabilityKind, ProductDeliveryType } from './product-details-payload'

const VIRTUAL_CATEGORIES: Record<string, { name: string; kind: ProductCapabilityKind }> = {
  'cat-virtual-question-set': { name: '测试题', kind: 'question_set' },
  'cat-virtual-skill': { name: 'Skill', kind: 'skill' },
  'cat-virtual-plugin': { name: '插件', kind: 'plugin' },
}

export function productTypeFromCategory(categoryId: string | null | undefined): {
  deliveryType: ProductDeliveryType
  capabilityKind: ProductCapabilityKind | null
} {
  const virtual = categoryId ? VIRTUAL_CATEGORIES[categoryId] : undefined
  return virtual
    ? { deliveryType: 'ai_capability', capabilityKind: virtual.kind }
    : { deliveryType: 'physical', capabilityKind: null }
}

export function virtualCategoryFromKind(kind: ProductCapabilityKind) {
  const [id, category] = Object.entries(VIRTUAL_CATEGORIES).find(([, value]) => value.kind === kind)!
  return { id, name: category.name }
}
