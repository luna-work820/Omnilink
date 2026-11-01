export const SHOPPING_PREFERENCE_QUESTIONS = [
  {
    key: 'purchasePriority',
    prompt: '挑选一件商品时，你最先看重什么？',
    options: ['耐用，能长期使用', '外观、材质和细节', '价格与实际价值', '方便、省心、好上手', '表达个性或兴趣', '因品类而异'],
  },
  {
    key: 'aesthetic',
    prompt: '哪些设计感觉更容易吸引你？',
    options: ['简洁克制', '自然温暖', '复古，有收藏感', '明亮活泼', '功能优先', '不固定'],
  },
  {
    key: 'qualityTradeoff',
    prompt: '面对价格和品质，你通常怎么权衡？',
    options: ['优先控制预算', '在价格与品质间平衡', '愿意为设计、材质或做工多花一些', '按品类分别考虑', '暂时没有固定预算'],
  },
  {
    key: 'decisionStyle',
    prompt: '买之前，你通常喜欢怎样了解商品？',
    options: ['先看参数和评价', '先看少量精选推荐', '先看真实使用体验', '喜欢线下试用', '先收藏，之后再决定'],
  },
  {
    key: 'novelty',
    prompt: '遇到没买过的品牌或新设计，你通常会？',
    options: ['倾向经典耐用、不易过时', '愿意从小件开始尝试', '愿意尝试新品牌和新设计', '会随品类变化'],
  },
  {
    key: 'avoid',
    prompt: '你最想避开什么购物体验？',
    options: ['质量和耐用性不确定', '不适合我的实际场景', '价格高于实际价值', '维护或使用太麻烦', '营销过度、信息不透明', '还没有明显顾虑'],
  },
] as const

export type ShoppingPreferenceKey = (typeof SHOPPING_PREFERENCE_QUESTIONS)[number]['key']
export type ShoppingPreferences = Partial<Record<ShoppingPreferenceKey, string>>

export function nextShoppingPreferenceQuestion(answers: ShoppingPreferences) {
  return SHOPPING_PREFERENCE_QUESTIONS.find((question) => !(question.key in answers)) ?? null
}
