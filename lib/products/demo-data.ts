export interface DemoProduct {
  id: string
  name: string
  name_en: string
  sku: string
  category: string
  category_en: string
  price: number
  currency: string
  inventory: number
  status: 'active' | 'draft' | 'archived'
  image_url: string
  description: string
  description_en: string
  created_at: string
  updated_at: string
  sales_count: number
  channels: {
    shopify: boolean
    amazon: boolean
    tiktok: boolean
    google: boolean
  }
  options: Array<{
    id: string
    name: string
    name_en: string
    code: string
    values: string[]
  }>
  variants: Array<{
    id: string
    sku: string
    price: number
    inventory: number
    status: 'active' | 'draft'
    option_values: Record<string, string>
    barcode?: string
  }>
  semantic_data: {
    brand: string
    category: string
    confidence: number
    key_features: string[]
    key_features_en: string[]
    target_audience: string
    target_audience_en: string
    attributes: Record<string, string | number | boolean>
    ai_search_terms: string[]
    agent_reasoning: string
    agent_reasoning_en: string
  }
  evidence: Array<{
    semantic_field: string
    evidence_type: 'merchant_input' | 'image' | 'document' | 'certification' | 'system_inference'
    evidence_source: string
    confidence: number
    field_value: string
  }>
  agent_qa: Array<{
    question: string
    question_en: string
    answer: string
    answer_en: string
  }>
}

export const DEMO_PRODUCTS: DemoProduct[] = []

export function getDemoProductById(id: string): DemoProduct | undefined {
  return DEMO_PRODUCTS.find((product) => product.id === id || product.sku.toLowerCase() === id.toLowerCase())
}
