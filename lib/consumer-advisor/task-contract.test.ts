import { describe, expect, it } from 'vitest'
import { advisorQuestionOptions, initialAdvisorQuestion, isStylingGoal, nextAdvisorQuestion, parseAdvisorResult, readBudget, styleDirectionFromAnswers, styleDiscoveryProductScore, type AdvisorProduct } from './task-contract'

const catalog: AdvisorProduct[] = [
  { id: 'dress', name: '连衣裙', price: 271, currency: 'CNY', category: '服饰', image: null, storeName: '演示店', storeSlug: null, source: 'demo_snapshot', description: '长袖' },
  { id: 'necklace', name: '项链', price: 128, currency: 'CNY', category: '珠宝配饰', image: null, storeName: '演示店', storeSlug: null, source: 'demo_snapshot', description: '大漆珠' },
  { id: 'coat', name: '外套', price: 677, currency: 'CNY', category: '服饰', image: null, storeName: '演示店', storeSlug: null, source: 'demo_snapshot', description: '短外套' },
]

describe('personal advisor task contract', () => {
  it('routes styling goals and reads the latest revised budget', () => {
    expect(isStylingGoal('周末看展，请帮我搭配衣服')).toBe(true)
    expect(isStylingGoal('查一下烟酰胺的 INCI 名称')).toBe(false)
    expect(readBudget('预算 500 元；改成预算是 350 元')).toBe(350)
    expect(readBudget('预算 500 元；预算改成 350 元')).toBe(350)
  })

  it('offers a short choice for a specific outfit and a three-question style exploration', () => {
    const outfit = '周末看展，帮我搭配衣服'
    const discovery = '我想判断自己的穿衣风格'
    expect(advisorQuestionOptions(initialAdvisorQuestion(outfit))).toContain('搭配已有衣物')
    expect(nextAdvisorQuestion(outfit, initialAdvisorQuestion(outfit))).toBeNull()
    expect(isStylingGoal(discovery)).toBe(true)
    const first = initialAdvisorQuestion(discovery)
    const second = nextAdvisorQuestion(discovery, first)
    const third = nextAdvisorQuestion(discovery, second)
    expect(advisorQuestionOptions(first)).toContain('简洁利落')
    expect(advisorQuestionOptions(second)).toContain('版型和线条')
    expect(advisorQuestionOptions(third)).toContain('黑白灰')
    expect(nextAdvisorQuestion(discovery, third)).toBeNull()
    expect(styleDirectionFromAnswers(discovery, ['简洁利落'])).toContain('可以先探索「简洁利落」方向')
    const plain = { ...catalog[0], name: '纯色简约直筒灰色连衣裙' }
    expect(styleDiscoveryProductScore(plain, ['简洁利落', '版型和线条', '黑白灰'])).toBeGreaterThan(styleDiscoveryProductScore(plain, ['简洁利落']))
    expect(styleDiscoveryProductScore({ ...catalog[0], name: '重工亮片国风连衣裙' }, ['简洁利落'])).toBeLessThan(0)
  })

  it('rejects unknown products and over-budget looks, then calculates totals from catalog facts', () => {
    const result = parseAdvisorResult(JSON.stringify({
      summary: '按预算选择',
      looks: [
        { title: '可选方案', reason: '适合看展', productIds: ['dress', 'necklace', 'fake'] },
        { title: '超预算', reason: '不应展示', productIds: ['coat'] },
      ],
      unknowns: ['尺码待确认'],
    }), catalog, '预算 500 元')
    expect(result.looks).toHaveLength(1)
    expect(result.looks[0].productIds).toEqual(['dress', 'necklace'])
    expect(result.looks[0].total).toBe(399)
    expect(result.products.map((item) => item.id)).toEqual(['dress', 'necklace'])
    expect(result.source).toBe('demo_snapshot')
  })

  it('uses a changed budget to reject a previously valid look', () => {
    const result = parseAdvisorResult(JSON.stringify({ looks: [{ productIds: ['dress', 'necklace'] }] }), catalog, '预算 500 元；改为预算 350 元')
    expect(result.budget).toBe(350)
    expect(result.looks).toHaveLength(0)
  })
})
