import { z } from 'zod'
import type { ClassifiedIntent } from './intent-classifier'
import { discoverySpecSchema, type DiscoverySpec } from './discovery-contract'
import { keywordSearchSpec, simpleProductSearchSpec } from './search-spec'
import { searchPatchSchema, type SearchScope } from './search-continuation'
import type { ProductItem } from '@/components/consumer-market/types'

export const consumerActionSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('search'), spec: discoverySpecSchema}),
  z.object({type: z.literal('keyword'), query: z.string().trim().min(1).max(160), itemType: z.enum(['商品','服务','数字']).default('商品')}),
  z.object({type: z.literal('compare')}),
  z.object({type: z.literal('information'), query: z.string().trim().min(1).max(160)}),
  z.object({type: z.literal('refine'), searchRunId:z.string().uuid(), contextVersion:z.number().int().nonnegative(), patch:searchPatchSchema}),
])
export type ConsumerAction = z.infer<typeof consumerActionSchema>

function decision(intent: ClassifiedIntent['intent'], search: DiscoverySpec | null = null,
  needsPersonalContext = false, needsSourceContext = false): ClassifiedIntent {
  return {intent, search, needsPersonalContext, needsSourceContext}
}

// An unmatched sentence goes to one parser. A generic "assistant" guess is not a rule match.
export function ruleConsumerExecution(input: {prompt: string; action?: ConsumerAction; hasImage: boolean;
  hasDocument: boolean; hasSelectedProducts: boolean; hasSources: boolean; scope?:SearchScope;catalogProducts?:readonly ProductItem[]}): ClassifiedIntent | null {
  if (input.hasDocument) return decision('document-analysis')
  if (input.hasImage) return decision('image-analysis')
  const action = input.action
  if (action?.type === 'search') return decision('product-search', action.spec)
  if (action?.type === 'keyword') return decision('product-search', keywordSearchSpec(action.query, action.itemType))
  if (action?.type === 'compare') return decision('comparison')
  if (action?.type === 'information') return decision('information-search', discoverySpecSchema.parse({query: action.query, termGroups: [], type: '数字'}))
  const prompt = input.prompt.trim()
  if (/^(你好|您好|嗨|hi|hello|hey)[!！。,.\s]*$/i.test(prompt)) return decision('assistant')
  if (/^https:\/\/[^\s]+$/i.test(prompt)) return decision('comparison')
  if (/^(?:比较|对比|compare)(?:这两款|这些|这几个|这几款| these| them| selected products)?[。！.!\s]*$/i.test(prompt)) return decision('comparison')
  if (/^(?:成分查询|查成分|ingredient lookup)\s*[:：]?\s*\S+/i.test(prompt)) return decision('ingredient-lookup')
  const simpleSearch=simpleProductSearchSpec(prompt,input.scope === 'service' ? '服务' : '商品',input.catalogProducts)
  if (simpleSearch) {
    if (input.scope === 'information') return decision('information-search', discoverySpecSchema.parse({query:simpleSearch.query, termGroups:[], type:'数字'}))
    return decision('product-search', simpleSearch)
  }
  if (input.hasSelectedProducts && /^(?:(?:这款|这个商品|这件|它)(?:的)?(?:材质|材料|尺寸|规格|颜色|价格|来源|品牌|库存|配送信息)(?:是什么|有哪些|是多少|多少)?|what (?:is|are) (?:the )?(?:material|price|size|colou?r|brand) (?:of|for) (?:this|it)(?: product)?)[？?。.\s]*$/i.test(prompt)) {
    return decision('product-question', null, false, input.hasSources)
  }
  return null
}
