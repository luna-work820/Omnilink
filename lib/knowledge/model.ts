export type KnowledgeDomain = 'merchant' | 'brand' | 'product' | 'customer' | 'operations'
export type KnowledgeKind = 'fact' | 'claim' | 'preference' | 'inference'
export type KnowledgeStatus = 'draft' | 'pending_review' | 'confirmed' | 'rejected'
export type KnowledgeSourceType = 'conversation' | 'file' | 'url' | 'product'

export interface KnowledgeSourceRecord {
  id: string
  type: KnowledgeSourceType
  label: string
  locator?: string
  createdAt: string
}

export interface KnowledgeEntryRecord {
  id: string
  domain: KnowledgeDomain
  key: string
  value: string
  kind: KnowledgeKind
  status: KnowledgeStatus
  sourceId?: string
  confidence?: number
  updatedAt: string
}

export interface MerchantKnowledgeModel {
  merchantId: string
  version: number
  sources: KnowledgeSourceRecord[]
  entries: KnowledgeEntryRecord[]
}
