import { z } from 'zod'
import type { ClassifiedIntent } from './intent-classifier'
import { discoverySpecSchema, type DiscoverySpec } from './discovery-contract'
import { keywordSearchSpec, simpleProductSearchSpec } from './search-spec'
import { hasRuleSearchPatch, searchPatchSchema, type SearchScope } from './search-continuation'
import { classifyProductKeyword, isComplexKeywordPrompt } from './product-keyword'
import { productCategoryConcepts } from './search-spec'
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
  needsPersonalContext = false, needsSourceContext = false,
  routeSource: NonNullable<ClassifiedIntent['routeSource']> = 'rule',
  keywordKind?: ClassifiedIntent['keywordKind']): ClassifiedIntent {
  return {intent, search, needsPersonalContext, needsSourceContext, routeSource, keywordKind}
}

export function searchCapability(intent: ClassifiedIntent['intent'], search: DiscoverySpec | null): SearchScope | 'digital' | null {
  if (!search) return null
  if (intent === 'information-search') return 'information'
  if (!['product-search','personalized-recommendation','cart-request','outfit-styling'].includes(intent)) return null
  return search.type === '服务' ? 'service' : search.type === '数字' ? 'digital' : 'product'
}

function simpleDomainSearch(prompt: string): ClassifiedIntent | null {
  const text=prompt.normalize('NFKC').trim().replace(/[。！.!]+$/,'')
  const prefix='(?:请帮我|帮我|我想|想|请|给我)?(?:查找|搜索|检索|寻找|找|搜)'
  const info=new RegExp(`^${prefix}(?:关于)?(.+?)(?:相关|有关)?的?(?:资料|文章|资讯|新闻|文献|攻略)$`, 'i').exec(text)
  const service=new RegExp(`^${prefix}(.+?)服务$`, 'i').exec(text)
  const topic=(info?.[1] ?? service?.[1])?.trim()
  if (!topic || topic.length>30 || !/^[\p{Script=Han}a-z0-9 -]+$/iu.test(topic)
      || /最新|最近|今年|去年|今天|明天|附近|同城|价格|预算|以上|以下|以内|必须|不要|适合|比较|对比|\d/i.test(topic)) return null
  if (info) return decision('information-search',discoverySpecSchema.parse({query:topic,termGroups:[],type:'数字'}))
  return decision('product-search',discoverySpecSchema.parse({query:topic,termGroups:[[topic]],type:'服务',retrieval:{mode:'auto'}}))
}

// An unmatched sentence goes to one parser. A generic "assistant" guess is not a rule match.
export function ruleConsumerExecution(input: {prompt: string; action?: ConsumerAction; hasImage: boolean;
  hasDocument: boolean; hasSelectedProducts: boolean; hasSources: boolean; scope?:SearchScope;
  catalogProducts?:readonly ProductItem[]; productSearchContext?:boolean}): ClassifiedIntent | null {
  if (input.hasDocument) return decision('document-analysis')
  if (input.hasImage) return decision('image-analysis')
  const action = input.action
  if (action?.type === 'search') return decision('product-search', action.spec, false, false, 'explicit')
  if (action?.type === 'keyword') {
    const spec = keywordSearchSpec(action.query, action.itemType, input.catalogProducts)
    const match = classifyProductKeyword(action.query, input.catalogProducts ?? [], productCategoryConcepts)
    return decision('product-search', spec, false, false, 'explicit', match?.kind)
  }
  if (action?.type === 'compare') return decision('comparison', null, false, false, 'explicit')
  if (action?.type === 'information') return decision('information-search', discoverySpecSchema.parse({query: action.query, termGroups: [], type: '数字'}), false, false, 'explicit')
  const prompt = input.prompt.trim()
  if (/^(你好|您好|嗨|hi|hello|hey)[!！。,.\s]*$/i.test(prompt)) return decision('assistant')
  if (/^https:\/\/[^\s]+$/i.test(prompt)) return decision('comparison')
  if (/^(?:比较|对比|compare)(?:这两款|这些|这几个|这几款| these| them| selected products)?[。！.!\s]*$/i.test(prompt)) return decision('comparison')
  if (/^(?:成分查询|查成分|ingredient lookup)\s*[:：]?\s*\S+/i.test(prompt)) return decision('ingredient-lookup')
  const domainSearch=simpleDomainSearch(prompt)
  if (domainSearch) return domainSearch
  const buy=/^(?:请帮我|帮我|我想|想|请|给我)?(?:购买|选购|买)(?:一件|一条|一双|一个|一些)?(.+)$/i.exec(prompt)
  const purchase=buy && simpleProductSearchSpec(buy[1],'商品',input.catalogProducts)
  if (purchase) return decision('product-search',purchase)
  const simpleSearch=simpleProductSearchSpec(prompt,input.scope === 'service' ? '服务' : '商品',input.catalogProducts)
  if (simpleSearch) {
    const match = classifyProductKeyword(prompt, input.catalogProducts ?? [], productCategoryConcepts)
    if (input.scope === 'information') return decision('information-search', discoverySpecSchema.parse({query:simpleSearch.query, termGroups:[], type:'数字'}), false, false, 'rule', match?.kind)
    return decision('product-search', simpleSearch, false, false, 'rule', match?.kind)
  }
  if (input.hasSelectedProducts && /^(?:(?:这款|这个商品|这件|它)(?:的)?(?:材质|材料|尺寸|规格|颜色|价格|来源|品牌|库存|配送信息)(?:是什么|有哪些|是多少|多少)?|what (?:is|are) (?:the )?(?:material|price|size|colou?r|brand) (?:of|for) (?:this|it)(?: product)?)[？?。.\s]*$/i.test(prompt)) {
    return decision('product-question', null, false, input.hasSources)
  }
  // Inside a product search, a short unrecognised term is still a product keyword.
  // Run the keyword search and report an explicit empty result instead of silently
  // reclassifying it as a资料 request or asking a model to guess.
  if (input.productSearchContext && !input.hasSelectedProducts && prompt && prompt.length <= 24
    && !hasRuleSearchPatch(prompt) && !isComplexKeywordPrompt(prompt)
    && /^[\p{L}\p{N}][\p{L}\p{N}\s'_-]*$/u.test(prompt)) {
    return decision('product-search', keywordSearchSpec(prompt, input.scope === 'service' ? '服务' : '商品', input.catalogProducts),
      false, false, 'rule', 'phrase')
  }
  return null
}
