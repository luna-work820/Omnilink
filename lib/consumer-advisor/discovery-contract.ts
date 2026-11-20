import { z } from 'zod'
import type { ProductItem } from '@/components/consumer-market/types'
import { retrievalOptionsSchema, type RetrievalReport } from './embedding-profile'
import type { ExchangeRates } from './exchange-rates'

export const discoverySpecSchema = z.object({
  query: z.string().trim().min(1).max(160),
  termGroups: z.array(z.array(z.string().trim().min(1).max(48)).min(1).max(5)).max(6),
  requiredTermGroups: z.array(z.array(z.string().trim().min(1).max(48)).min(1).max(5)).max(6).optional(),
  categoryTerm: z.string().trim().min(1).max(48).optional(),
  excludedTerms: z.array(z.string().trim().min(1).max(48)).max(10).default([]),
  minPrice: z.number().nonnegative().max(1e9).nullable().default(null),
  maxPrice: z.number().nonnegative().max(1e9).nullable().default(null),
  currency: z.string().regex(/^[A-Z]{3}$/).default('CNY'),
  type: z.enum(['商品', '服务', '数字']).default('商品'),
  sessionTerms: z.array(z.string().trim().min(1).max(48)).max(8).default([]),
  questionDismissed: z.boolean().default(false),
  excludedProductIds: z.array(z.string().min(1).max(100)).max(100).optional(),
  retrieval: retrievalOptionsSchema.optional(),
  usePersonalContext: z.boolean().optional(),
  deliveryCountry: z.string().regex(/^[A-Z]{2}$/).optional(),
  requireVerifiedDelivery: z.boolean().optional(),
}).refine((s) => s.minPrice === null || s.maxPrice === null || s.minPrice <= s.maxPrice, '价格范围无效。')
  .refine((s)=>!s.requireVerifiedDelivery||Boolean(s.deliveryCountry),'请指定配送国家。')

export type DiscoverySpec = z.infer<typeof discoverySpecSchema>
const discoveryReferenceSchema = z.object({searchRunId:z.string().uuid(),contextVersion:z.number().int().nonnegative(),spec:discoverySpecSchema})
export type DiscoveryReference = z.infer<typeof discoveryReferenceSchema>
export function readDiscoveryReference(blocks:unknown):DiscoveryReference|undefined {
  if(!Array.isArray(blocks))return undefined
  for(const block of blocks.slice(0,8)) {
    if(block?.type!=='discovery_feed')continue
    const parsed=discoveryReferenceSchema.safeParse(block.data)
    if(parsed.success)return parsed.data
  }
}
export type DiscoveryQuestion = { id: 'style'; prompt: string; options: { value: string; label: string; terms: string[] }[] }
export type DiscoveryPage = {
  searchRunId: string
  sessionId: string
  query: string
  products: ProductItem[]
  nextCursor: string | null
  contextVersion: number
  snapshotVersion: 1
  pageSize: 20
  returnedCount: number
  candidateCount: number
  question: DiscoveryQuestion | null
  spec: DiscoverySpec
  retrieval?: RetrievalReport
  priceReference?: ExchangeRates | null
  priceWarning?: boolean
}
export type DiscoveryFeedBlock = { type: 'discovery_feed'; id: string; version: 1; data: DiscoveryPage }
export type QuestionnaireBlock = { type: 'questionnaire'; id: string; version: 1; data: DiscoveryQuestion; state: 'pending' }
export type ConsumerResponseBlock = DiscoveryFeedBlock | QuestionnaireBlock | { type: 'chat_message'; id: string; version: 1; data: { text: string } }

export class DiscoveryError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) { super(message) }
}

export function discoveryBlocks(page: DiscoveryPage): ConsumerResponseBlock[] {
  return [{ type: 'discovery_feed', id: page.searchRunId, version: 1, data: page },
    ...(page.question ? [{ type: 'questionnaire' as const, id: `${page.searchRunId}:style`, version: 1 as const, data: page.question, state: 'pending' as const }] : [])]
}

export function discoveryQuestion(spec: DiscoverySpec): DiscoveryQuestion | null {
  if (spec.questionDismissed || spec.sessionTerms.length || !/沙发|椅|家具|桌|sofa|chair|furniture|table/i.test(spec.termGroups.flat().join(' '))) return null
  return { id: 'style', prompt: '这次更偏向哪种风格？', options: [
    { value: 'simple', label: '简洁', terms: ['简洁', '简约', 'minimal'] },
    { value: 'natural', label: '自然', terms: ['原木', '木质', 'natural', 'wood'] },
    { value: 'vintage', label: '复古', terms: ['复古', 'vintage', 'retro'] },
    { value: 'any', label: '不限定', terms: [] },
  ] }
}
