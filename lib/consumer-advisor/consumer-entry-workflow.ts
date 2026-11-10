import 'server-only'

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { isOutfitStylingGoal } from './task-contract'
import { catalogFallback } from './catalog-fallback'
import { parseAiAssistantMemoryCandidate } from './ai-assistant-profile'
import type { AiAssistantMemory } from './ai-assistant-memory'
import { SEED_CATEGORIES } from '@/lib/product/categories'
import { getStorefrontDiscoveryItems, searchStorefrontDiscoveryItems, type StorefrontDiscoveryItem } from '@/lib/storefront/service'
import { searchConsumerCatalogByVector } from './consumer-catalog-vector'

const catalogTerms = [...new Set(SEED_CATEGORIES.flatMap((category) => [
  category.name,
  category.nameEn,
  ...(category.keywords ?? []),
].filter((term): term is string => Boolean(term))))]

const routeInput = z.object({
  prompt: z.string().max(2000),
  hasImage: z.boolean(),
  hasDocument: z.boolean(),
  hasActiveSkill: z.boolean(),
  hasSelectedProducts: z.boolean(),
  previousIntent: z.enum([
    'outfit-styling', 'product-search', 'product-question', 'comparison',
    'personalized-recommendation', 'cart-request',
  ]).optional(),
})

const routeOutput = z.object({
  intent: z.enum([
    'ingredient-lookup',
    'image-analysis',
    'document-analysis',
    'outfit-styling',
    'product-search',
    'product-question',
    'comparison',
    'personalized-recommendation',
    'cart-request',
    'assistant',
  ]),
})

const routeConsumerIntent = createStep({
  id: 'route-consumer-intent',
  inputSchema: routeInput,
  outputSchema: routeOutput,
  execute: async ({ inputData }) => {
    const prompt = inputData.prompt.trim()
    const productSpecificQuestion = /(这款|这个商品|这个产品|该商品|该产品|这件商品|这瓶|这支|这台)/.test(prompt)
    const outfitFollowUp = /(再|更|换|改|正式|休闲|颜色|类似|不太|喜欢|第二套|另一套|还有|继续|刚才|上面|这套|那套)/.test(prompt)
    const productFollowUp = /(再|更|换|改|便宜|价格|贵|小|大|颜色|银色|金色|简洁|简单|类似|不要|不想要|其它|其他|另外|继续|刚才|上面|这款|那款|上一款)/.test(prompt)
    const comparisonFollowUp = /(再|更|换|改|价格|便宜|贵|材质|尺寸|颜色|区别|另一款|另外一款|哪个|这款|那款|继续|刚才|上面)/.test(prompt)
    const historyPreferenceRequest = /(按|根据|结合|参考).{0,6}(历史|之前|以前|记忆|偏好|说过|提过)|我(?:之前|以前|上次).{0,6}(?:说过|提过|喜欢|偏好|选过)|按上次|参考上次|继续上次/.test(prompt)
    const outfitGoal = !inputData.hasActiveSkill && isOutfitStylingGoal(prompt)
    const mentionsCatalogTerm = catalogTerms.some((term) => term.length >= 2 && prompt.toLowerCase().includes(term.toLowerCase()))
    const catalogInformationQuestion = /(是什么|什么是|如何|怎么|为什么|材质|材料|成分|规格|尺寸|保修|库存|配送|退换|评价)/.test(prompt)
    const ingredientIntent = !inputData.hasImage && !inputData.hasDocument && !inputData.hasActiveSkill && !inputData.hasSelectedProducts && !productSpecificQuestion &&
      /(成分查询|查(?:一下)?成分|分析成分|配料表|\binci\b|\bcosing\b|\bcas\s*(号|number)?\b|ingredient|[a-z][a-z /-]{3,}\s*(是什么|安全吗|适合|用途|作用))/i.test(prompt)

    let intent: z.infer<typeof routeOutput>['intent']
    if (inputData.hasDocument) intent = 'document-analysis'
    else if (ingredientIntent) intent = 'ingredient-lookup'
    else if (/(加入购物车|放进购物车|放到购物车|加购|add\s+to\s+cart)/i.test(prompt)) intent = 'cart-request'
    else if (/(比较|对比|区别|差异|哪个更|哪个好|compare|versus|\bvs\b|这(?:两|几)款.{0,8}(?:价格|材质|区别|优缺点|哪个好)|它们.{0,8}(?:价格|材质|区别|优缺点|哪个好))/i.test(prompt)) intent = 'comparison'
    else if (inputData.previousIntent === 'comparison' && comparisonFollowUp) intent = 'comparison'
    else if (outfitGoal) intent = 'outfit-styling'
    else if (inputData.hasImage) intent = 'image-analysis'
    else if (inputData.hasSelectedProducts || productSpecificQuestion || /(怎么用|如何使用|规格|尺寸|材质|成分|保修|库存|配送|退换|评价|详细信息)/.test(prompt)) intent = 'product-question'
    else if (inputData.hasActiveSkill || historyPreferenceRequest || /(适合我|根据我的|按照我的|按我的偏好|为我(?:挑|推荐)|给我推荐|结合我的偏好|个性化)/.test(prompt)) intent = 'personalized-recommendation'
    else if (/(推荐|搜索|查找|找一个|找一款|有没有|想买|想看|帮我找|帮我挑|买一个|买一款|search(?: for)?|find|recommend|looking for|want to buy)/i.test(prompt) || (mentionsCatalogTerm && !catalogInformationQuestion)) intent = 'product-search'
    else if (inputData.previousIntent === 'outfit-styling' && outfitFollowUp) intent = 'outfit-styling'
    else if ((inputData.previousIntent === 'product-search' || inputData.previousIntent === 'personalized-recommendation') && productFollowUp) intent = inputData.previousIntent
    else if (inputData.previousIntent === 'product-question' && productFollowUp) intent = 'product-question'
    else intent = 'assistant'

    return { intent }
  },
})

export const consumerEntryWorkflow = createWorkflow({
  id: 'consumer-entry-routing',
  description: '将统一的消费者输入路由到确定性资料检索或带个人上下文的助手流程。',
  inputSchema: routeInput,
  outputSchema: routeOutput,
}).then(routeConsumerIntent).commit()

export async function routeConsumerEntry(input: z.infer<typeof routeInput>) {
  const run = await consumerEntryWorkflow.createRun({ shouldPersistSnapshot: () => false })
  const result = await run.start({ inputData: input })
  if (result.status !== 'success') {
    throw result.status === 'failed' ? result.error : new Error('消费者助手流程未能完成。')
  }
  return result.result
}

const consumerSearchInput = z.object({
  query: z.string().max(2400),
  enabled: z.boolean(),
  maxPrice: z.number().nullable(),
})

const consumerSearchOutput = z.object({
  recentProductIds: z.array(z.string()).max(36),
  keywordProductIds: z.array(z.string()).max(48),
  semanticProductIds: z.array(z.string()).max(50),
  rankedProductIds: z.array(z.string()).max(98),
})

const retrieveHybridCatalogCandidates = createStep({
  id: 'retrieve-hybrid-catalog-candidates',
  inputSchema: consumerSearchInput,
  outputSchema: consumerSearchOutput,
  execute: async ({ inputData }) => {
    const [recentItems, keywordItems, semanticMatches]: [
      StorefrontDiscoveryItem[],
      StorefrontDiscoveryItem[],
      { id: string; similarity: number }[],
    ] = await Promise.all([
      getStorefrontDiscoveryItems(36).catch((): StorefrontDiscoveryItem[] => []),
      inputData.enabled ? searchStorefrontDiscoveryItems(inputData.query, 24).catch((): StorefrontDiscoveryItem[] => []) : Promise.resolve([] as StorefrontDiscoveryItem[]),
      inputData.enabled ? searchConsumerCatalogByVector(inputData.query, 24, inputData.maxPrice).catch((): { id: string; similarity: number }[] => []) : Promise.resolve([] as { id: string; similarity: number }[]),
    ])
    const recentProductIds = recentItems.map(({ product }) => product.id)
    const keywordProductIds = keywordItems.map(({ product }) => product.id)
    const semanticProductIds = semanticMatches.map(({ id }) => id)
    return {
      recentProductIds,
      keywordProductIds,
      semanticProductIds,
      rankedProductIds: reciprocalRankedProductIds([keywordProductIds, semanticProductIds]),
    }
  },
})

export const consumerHybridCatalogSearchWorkflow = createWorkflow({
  id: 'consumer-hybrid-catalog-search',
  description: '并行召回公开商品的关键词候选和本地语义候选，再合并排序。',
  inputSchema: consumerSearchInput,
  outputSchema: consumerSearchOutput,
}).then(retrieveHybridCatalogCandidates).commit()

export async function retrieveConsumerSearchCandidates(input: z.infer<typeof consumerSearchInput>) {
  const run = await consumerHybridCatalogSearchWorkflow.createRun({ shouldPersistSnapshot: () => false })
  const result = await run.start({ inputData: input })
  if (result.status !== 'success') {
    throw result.status === 'failed' ? result.error : new Error('商品混合检索未能完成。')
  }
  return result.result
}

const taskMemorySchema = z.object({
  id: z.string(),
  domain: z.enum(['clothing', 'skin', 'hair', 'space', 'other']),
  text: z.string().max(240),
  origin: z.enum(['user', 'inferred']),
  status: z.enum(['active', 'rejected']),
})

const taskProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  price: z.number(),
  storeName: z.string(),
})

const taskPlanInput = z.object({
  prompt: z.string().max(2000),
  intent: routeOutput.shape.intent,
  history: z.array(z.string().max(1200)).max(6),
  memories: z.array(taskMemorySchema).max(50),
  catalog: z.array(taskProductSchema).max(100),
  selectedProductIds: z.array(z.string()).max(12),
  previousProductIds: z.array(z.string()).max(6),
  savedProductIds: z.array(z.string()).max(12),
  rejectedProductIds: z.array(z.string()).max(100),
  semanticProductIds: z.array(z.string()).max(50).default([]),
  keywordProductIds: z.array(z.string()).max(50).default([]),
})

const taskPlanWithMemories = taskPlanInput.extend({ relevantMemoryIds: z.array(z.string()).max(6) })
const catalogSearchResultSchema = z.object({
  analysisText: z.string(),
  matchedProductIds: z.array(z.string()).max(3),
  matchReasons: z.record(z.string(), z.string()),
})

const taskPlanOutput = z.object({
  intent: routeOutput.shape.intent,
  relevantMemoryIds: z.array(z.string()).max(6),
  comparisonProductIds: z.array(z.string()).max(6),
  memoryCaptureRequested: z.boolean(),
  searchResult: catalogSearchResultSchema.nullable(),
})

function memoryTerms(value: string): Set<string> {
  const terms = new Set<string>()
  const normalized = value.toLowerCase()
  for (const word of normalized.match(/[a-z0-9]{2,}/g) ?? []) terms.add(word)
  for (const phrase of normalized.match(/\p{Script=Han}+/gu) ?? []) {
    if (phrase.length === 1) terms.add(phrase)
    for (let index = 0; index < phrase.length - 1; index += 1) terms.add(phrase.slice(index, index + 2))
  }
  return terms
}

function relevantMemoryIds(input: z.infer<typeof taskPlanInput>): string[] {
  const needsMemory = [
    'product-search', 'product-question', 'comparison', 'personalized-recommendation',
    'cart-request', 'outfit-styling',
  ].includes(input.intent)
  if (!needsMemory) return []

  const prompt = input.prompt.trim()
  const historyRequest = /(按|根据|结合|参考).{0,6}(历史|之前|以前|记忆|偏好|说过|提过)|我(?:之前|以前|上次).{0,6}(?:说过|提过|喜欢|偏好|选过)|按上次|参考上次|继续上次/.test(prompt)
  const userHistory = input.history.filter((entry) => entry.startsWith('用户：')).join('\n')
  const previousProducts = input.catalog.filter((product) => input.previousProductIds.includes(product.id))
  const query = `${prompt}\n${userHistory}\n${previousProducts.map((product) => `${product.name} ${product.category}`).join(' ')}`
  const queryTerms = memoryTerms(query)
  const queryDomains = new Set<AiAssistantMemory['domain']>()
  if (/(穿搭|衣服|衣橱|裙|裤|鞋|耳饰|耳环|耳钉|项链|手链|戒指|饰品|配饰|风格|颜色)/.test(query)) queryDomains.add('clothing')
  if (/(护肤|皮肤|面霜|洁面|精华|保湿|控油|敏感肌)/.test(query)) queryDomains.add('skin')
  if (/(头发|发型|染发|洗发|护发)/.test(query)) queryDomains.add('hair')
  if (/(空间|家居|家具|灯|沙发|桌|椅|房间|装修)/.test(query)) queryDomains.add('space')
  if (!queryDomains.size) queryDomains.add('other')

  const active = input.memories.filter((memory) => memory.status === 'active')
  const ranked = active.map((memory, index) => {
    const terms = memoryTerms(memory.text)
    let score = [...terms].filter((term) => queryTerms.has(term)).length * 2
    if (queryDomains.has(memory.domain)) score += 4
    if (historyRequest) score += 2
    return { id: memory.id, score, index }
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 6)
    .map((item) => item.id)

  if (ranked.length || !historyRequest) return ranked
  return active.slice(0, 6).map((memory) => memory.id)
}

export function selectRelevantConsumerMemoryIds(
  prompt: string,
  history: string[],
  memories: AiAssistantMemory[],
  intent: z.infer<typeof routeOutput>['intent'] = 'product-search',
) {
  return relevantMemoryIds({
    prompt,
    history,
    memories,
    intent,
    catalog: [],
    selectedProductIds: [],
    previousProductIds: [],
    savedProductIds: [],
    rejectedProductIds: [],
    semanticProductIds: [],
    keywordProductIds: [],
  })
}

function reciprocalRankedProductIds(lists: string[][]) {
  const scores = new Map<string, number>()
  for (const list of lists) {
    list.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (60 + index + 1)))
  }
  return [...scores].sort((left, right) => right[1] - left[1]).map(([id]) => id)
}

const retrieveRelevantMemories = createStep({
  id: 'retrieve-relevant-consumer-memories',
  inputSchema: taskPlanInput,
  outputSchema: taskPlanWithMemories,
  execute: async ({ inputData }) => ({ ...inputData, relevantMemoryIds: relevantMemoryIds(inputData) }),
})

const retrieveCatalogAndPlanTask = createStep({
  id: 'retrieve-products-and-prepare-task',
  inputSchema: taskPlanWithMemories,
  outputSchema: taskPlanOutput,
  execute: async ({ inputData }) => {
    const { intent, prompt, history, catalog, selectedProductIds } = inputData
    const query = `${prompt}\n${history.filter((entry) => entry.startsWith('用户：')).join('\n')}`
    const relativePriceFollowUp = /(更便宜|便宜(?:一点|一些|些|点)|再低一点|低价一点)/.test(prompt)
    const refersToPreviousProducts = /(这(?:两|几)款|上面|上次|刚才|它们|其中|哪一款|哪个好|比较这|这款|那款|上一款)/.test(prompt) || relativePriceFollowUp
    const directSearch = ['product-search', 'cart-request', 'assistant', 'comparison'].includes(intent) &&
      !(refersToPreviousProducts && inputData.previousProductIds.length > 0)
      ? catalogFallback(prompt, catalog, inputData.savedProductIds, inputData.rejectedProductIds)
      : null
    const normalizedQuery = query.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
    const mentionedProductIds = catalog.filter((product) => {
      const normalizedName = product.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      return normalizedName.length >= 3 && normalizedQuery.includes(normalizedName)
    }).map((product) => product.id)
    const comparisonProductIds = intent === 'comparison'
      ? [...new Set([
        ...selectedProductIds,
        ...(refersToPreviousProducts ? inputData.previousProductIds : []),
        ...mentionedProductIds,
        ...(directSearch?.matchedProductIds ?? []),
      ])].slice(0, 6)
      : []

    const searchResult = directSearch
    if (searchResult) {
      const availableIds = new Set(catalog.map((product) => product.id))
      const rankedIds = reciprocalRankedProductIds([
        inputData.keywordProductIds,
        inputData.semanticProductIds,
        searchResult.matchedProductIds,
      ])
      const matchedProductIds = rankedIds.filter((id) => availableIds.has(id) && !inputData.rejectedProductIds.includes(id)).slice(0, 3)
      const matchReasons = { ...searchResult.matchReasons }
      for (const id of matchedProductIds) {
        if (matchReasons[id]) continue
        const product = catalog.find((item) => item.id === id)
        if (product) matchReasons[id] = `語義檢索匹配本輪需求；商品分類為${product.category}。`
      }
      return {
        intent,
        relevantMemoryIds: inputData.relevantMemoryIds,
        comparisonProductIds,
        memoryCaptureRequested: /我(?:一直|平时|通常|长期)?(?:喜欢|偏好|倾向)|我不喜欢|请(?:你)?记住|记住我|以后.{0,8}(?:记得|按|参考)/.test(prompt),
        searchResult: { ...searchResult, matchedProductIds, matchReasons },
      }
    }

    return {
      intent,
      relevantMemoryIds: inputData.relevantMemoryIds,
      comparisonProductIds,
      memoryCaptureRequested: /我(?:一直|平时|通常|长期)?(?:喜欢|偏好|倾向)|我不喜欢|请(?:你)?记住|记住我|以后.{0,8}(?:记得|按|参考)/.test(prompt),
      searchResult,
    }
  },
})

export const consumerTaskPlanWorkflow = createWorkflow({
  id: 'consumer-task-plan',
  description: '按意图编排相关记忆检索、商品候选检索和比较对象准备。',
  inputSchema: taskPlanInput,
  outputSchema: taskPlanOutput,
}).then(retrieveRelevantMemories).then(retrieveCatalogAndPlanTask).commit()

export async function planConsumerTask(input: z.infer<typeof taskPlanInput>) {
  const run = await consumerTaskPlanWorkflow.createRun({ shouldPersistSnapshot: () => false })
  const result = await run.start({ inputData: input })
  if (result.status !== 'success') {
    throw result.status === 'failed' ? result.error : new Error('消费者任务计划未能完成。')
  }
  return result.result
}

const memoryCandidateSchema = z.object({
  text: z.string().max(120),
  domain: z.enum(['clothing', 'skin', 'hair', 'space', 'other']),
  origin: z.enum(['user', 'inferred']),
  evidence: z.string(),
  supports: z.array(z.string()),
  supersedeIds: z.array(z.string()),
})

const memoryUpdateInput = z.object({
  prompt: z.string().max(2000),
  memoryUpdate: z.unknown(),
  memories: z.array(taskMemorySchema).max(50),
})

const validateMemoryEvidence = createStep({
  id: 'validate-memory-evidence',
  inputSchema: memoryUpdateInput,
  outputSchema: z.object({ candidate: memoryCandidateSchema.nullable(), memories: z.array(taskMemorySchema).max(50) }),
  execute: async ({ inputData }) => ({
    candidate: parseAiAssistantMemoryCandidate(
      inputData.memoryUpdate,
      inputData.prompt,
      inputData.memories.filter((memory) => memory.status === 'active').map((memory) => memory.id),
    ),
    memories: inputData.memories,
  }),
})

const rejectDuplicateMemory = createStep({
  id: 'reject-duplicate-memory',
  inputSchema: z.object({ candidate: memoryCandidateSchema.nullable(), memories: z.array(taskMemorySchema).max(50) }),
  outputSchema: z.object({ candidate: memoryCandidateSchema.nullable() }),
  execute: async ({ inputData }) => {
    const candidate = inputData.candidate
    if (!candidate || inputData.memories.length >= 50) return { candidate: null }
    const duplicate = inputData.memories.some((memory) =>
      memory.status === 'active' && memory.domain === candidate.domain && memory.text === candidate.text)
    return { candidate: duplicate ? null : candidate }
  },
})

export const consumerMemoryUpdateWorkflow = createWorkflow({
  id: 'consumer-memory-update',
  description: '校验记忆候选的用户证据、支持记忆和重复状态，再交由应用层持久化。',
  inputSchema: memoryUpdateInput,
  outputSchema: z.object({ candidate: memoryCandidateSchema.nullable() }),
}).then(validateMemoryEvidence).then(rejectDuplicateMemory).commit()

export async function validateConsumerMemoryUpdate(input: z.infer<typeof memoryUpdateInput>) {
  const run = await consumerMemoryUpdateWorkflow.createRun({ shouldPersistSnapshot: () => false })
  const result = await run.start({ inputData: input })
  if (result.status !== 'success') {
    throw result.status === 'failed' ? result.error : new Error('记忆更新校验未能完成。')
  }
  return result.result.candidate
}
