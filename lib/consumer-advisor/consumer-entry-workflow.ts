import 'server-only'

import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { catalogFallback } from './catalog-fallback'
import { parseAiAssistantMemoryCandidate } from './ai-assistant-profile'
import type { AiAssistantMemory } from './ai-assistant-memory'
import { retrieveDiscoveryCandidates } from './discovery-retrieval'
import { discoverySpecSchema } from './discovery-contract'
import { ruleConsumerExecution } from './execution-policy'
import { fuseProductIds as reciprocalRankedProductIds } from './search-spec'

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
    const intent=ruleConsumerExecution({...inputData,hasSources:false})?.intent??'assistant'
    return {intent:intent==='information-search'?'assistant' as const:intent}
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
  spec: discoverySpecSchema,
  enabled: z.boolean(),
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
    if(!inputData.enabled)return {recentProductIds:[],keywordProductIds:[],semanticProductIds:[],rankedProductIds:[]}
    const result=await retrieveDiscoveryCandidates(inputData.spec)
    return {recentProductIds:[],keywordProductIds:result.keywordIds.slice(0,48),semanticProductIds:result.semanticIds.slice(0,50),
      rankedProductIds:result.products.slice(0,98).map((product)=>product.id)}
  },
})

export const consumerHybridCatalogSearchWorkflow = createWorkflow({
  id: 'consumer-hybrid-catalog-search',
  description: '通过统一 Discovery 执行 Search Spec，供现有工作流复用。',
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
  status: z.enum(['proposed', 'active', 'rejected']),
  confirmedAt: z.string().nullable().optional(),
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

  const active = input.memories.filter((memory) => memory.status === 'active' && memory.confirmedAt)
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
      inputData.memories.filter((memory) => memory.status === 'active' && memory.confirmedAt).map((memory) => memory.id),
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
    if (!candidate || inputData.memories.filter((memory) => memory.status !== 'rejected').length >= 50) return { candidate: null }
    const duplicate = inputData.memories.some((memory) =>
      memory.status !== 'rejected' && memory.domain === candidate.domain && memory.text.trim().toLowerCase().replace(/\s+/g, ' ') === candidate.text.trim().toLowerCase().replace(/\s+/g, ' '))
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
