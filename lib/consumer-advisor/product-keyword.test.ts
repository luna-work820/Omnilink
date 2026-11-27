import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
import { classifyProductKeyword, isComplexKeywordPrompt, normalizeKeyword, productModelFacts } from './product-keyword'
import { keywordSearchSpec, rankKeywordProducts, simpleProductSearchSpec } from './search-spec'
import { ruleConsumerExecution } from './execution-policy'
import { retrieveDiscoveryCandidates } from './discovery-retrieval'
import { productCategoryConcepts } from './search-spec'

const base = readConsumerCatalog()[0]
const baseInput = { hasImage: false, hasDocument: false, hasSelectedProducts: false, hasSources: false }
const cameraCatalog = [
  { ...base, id: 'r5', name: 'Canon R5 camera body', category: '相机', storeName: 'Sony 官方店', specs: { 品牌: 'Canon', 型号: 'R5' } },
  { ...base, id: 'r5ii', name: 'Canon R5 Mark II camera body', category: '相机', storeName: '相机之家', specs: { 品牌: 'Canon', 型号: 'R5 Mark II' } },
  { ...base, id: 'shampoo', name: '柔顺洗发水', category: '洗发水', storeName: '洗护旗舰店', specs: {} },
  { ...base, id: 'earbuds', name: '无线耳机', category: '耳机', storeName: '音频店', specs: {} },
]

describe('catalog-derived product keyword recognition', () => {
  it('normalizes case, spaces, full-width forms and edge punctuation', () => {
    expect(normalizeKeyword('  Ｃａｎｏｎ　Ｒ５！ ')).toBe('canon r5')
    expect(normalizeKeyword('相机。')).toBe('相机')
    expect(classifyProductKeyword('  ＣＡＭＥＲＡ ', cameraCatalog, productCategoryConcepts)?.kind).toBe('category')
  })

  it('recognizes a category that exists only as a catalog field, without a hardcoded word list', () => {
    expect(classifyProductKeyword('洗发水', cameraCatalog)).toMatchObject({ kind: 'category', term: '洗发水' })
    expect(classifyProductKeyword('相机', cameraCatalog)).toMatchObject({ kind: 'category', term: '相机' })
  })

  it('recognizes published names, brands, stores and models from structured fields', () => {
    expect(classifyProductKeyword('Canon R5 camera body', cameraCatalog)?.kind).toBe('name')
    expect(classifyProductKeyword('Canon', cameraCatalog)?.kind).toBe('brand')
    expect(classifyProductKeyword('Sony 官方店', cameraCatalog)?.kind).toBe('store')
    expect(classifyProductKeyword('Canon R5', cameraCatalog)?.kind).toBe('model')
    expect(productModelFacts(cameraCatalog[1])).toContain('canon r5 mark ii')
    expect(productModelFacts(cameraCatalog[1])).not.toContain('canon r5')
  })

  it('handles short search phrases by stripping the search prefix and measure word', () => {
    for (const prompt of ['找相机', '搜索洗发水', '帮我找耳机']) {
      const match = classifyProductKeyword(prompt, cameraCatalog, productCategoryConcepts)
      expect(match).not.toBeNull()
      expect(match?.aliases.length).toBeGreaterThan(0)
    }
    expect(simpleProductSearchSpec('找相机', '商品', cameraCatalog)?.retrieval?.mode).toBe('keyword')
  })

  it.each([
    '摄影器材怎么选？', '相机适合我吗？', 'Canon R5 和 R6 有什么区别？', '相机 5000 元以内',
    '适合旅行的轻便相机', '不要真皮的黑色包', '摄影器材选购攻略', '搜索摄影器材文章',
    '我喜欢裙子', '黑色连衣裙', '把预算改成 1000',
  ])('does not flatten a qualified request into a bare keyword: %s', (prompt) => {
    expect(isComplexKeywordPrompt(prompt)).toBe(true)
    expect(classifyProductKeyword(prompt, cameraCatalog, productCategoryConcepts)).toBeNull()
  })

  it('keeps an exact model distinct from a longer model sharing its prefix', () => {
    const spec = keywordSearchSpec('Canon R5', '商品', cameraCatalog)
    expect(spec.modelTerms).toEqual(['canon r5'])
    const ranked = rankKeywordProducts(cameraCatalog, spec)
    expect(ranked.map((product) => product.id)).toEqual(['r5'])
  })

  it('uses the same rule and retrieval mode from the front-end and the assistant route', () => {
    const decision = ruleConsumerExecution({ ...baseInput, prompt: 'Canon R5', catalogProducts: cameraCatalog })
    const frontEndSpec = simpleProductSearchSpec('Canon R5', '商品', cameraCatalog)
    expect(decision?.intent).toBe('product-search')
    expect(decision?.search?.retrieval?.mode).toBe(frontEndSpec?.retrieval?.mode)
    expect(decision?.search?.modelTerms).toEqual(frontEndSpec?.modelTerms)
    expect(decision?.search?.termGroups).toEqual(frontEndSpec?.termGroups)
  })

  it('keeps a keyword miss explicit inside a product search without starting vector recall', async () => {
    const semantic = vi.fn()
    const decision = ruleConsumerExecution({ ...baseInput, prompt: 'mesquite', catalogProducts: cameraCatalog, productSearchContext: true })
    expect(decision).toMatchObject({ intent: 'product-search', routeSource: 'rule' })
    expect(decision?.search?.retrieval?.mode).toBe('keyword')
    const result = await retrieveDiscoveryCandidates(decision!.search!, { positiveTerms: [], avoidTerms: [],
      routeSource: decision!.routeSource, keywordKind: decision!.keywordKind }, undefined,
    { catalog: () => cameraCatalog, semantic })
    expect(result.products).toEqual([])
    expect(result.report).toMatchObject({ effectiveMode: 'keyword', routeSource: 'rule', keywordKind: 'phrase',
      resultReason: 'NO_KEYWORD_MATCH', embeddingCalls: 0 })
    expect(semantic).not.toHaveBeenCalled()
  })

  it('does not claim a product search for an unknown term without a product context', () => {
    expect(ruleConsumerExecution({ ...baseInput, prompt: 'mesquite', catalogProducts: cameraCatalog })).toBeNull()
  })

  it('records route and keyword type with the retrieval report', async () => {
    const spec = keywordSearchSpec('相机', '商品', cameraCatalog)
    const semantic = vi.fn()
    const result = await retrieveDiscoveryCandidates(spec, { positiveTerms: [], avoidTerms: [],
      routeSource: 'explicit', keywordKind: 'category' }, undefined, { catalog: () => cameraCatalog, semantic })
    expect(result.report).toMatchObject({ requestedMode: 'keyword', effectiveMode: 'keyword',
      routeSource: 'explicit', keywordKind: 'category', resultReason: 'MATCH', embeddingCalls: 0 })
    expect(semantic).not.toHaveBeenCalled()
  })

  it('makes backed composition facts retrievable by keyword', () => {
    const withComposition = { ...base, id: 'viscose-dress', name: 'Mini Dress Drama', category: '服饰',
      composition: { kind: 'textile-fiber' as const, status: 'partial' as const,
        items: [{ name: 'Viscose', position: 1 }], rawText: 'Fabric: 100% Viscose' } }
    const spec = keywordSearchSpec('Viscose', '商品', [withComposition])
    expect(rankKeywordProducts([withComposition], spec).map((product) => product.id)).toEqual(['viscose-dress'])
  })

  it('leaves explicit resource, comparison and selected-product paths untouched', () => {
    expect(ruleConsumerExecution({ ...baseInput, prompt: '搜索摄影器材文章' })?.intent).toBe('information-search')
    expect(ruleConsumerExecution({ ...baseInput, prompt: '比较这两款', hasSelectedProducts: true })?.intent).toBe('comparison')
    expect(ruleConsumerExecution({ ...baseInput, prompt: '这件的材质是什么？', hasSelectedProducts: true,
      catalogProducts: cameraCatalog, productSearchContext: true })?.intent).toBe('product-question')
    expect(ruleConsumerExecution({ ...baseInput, prompt: '换成金色', catalogProducts: cameraCatalog,
      productSearchContext: true })).toBeNull()
  })
})
