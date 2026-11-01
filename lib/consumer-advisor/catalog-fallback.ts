type CatalogItem = {
  id: string
  name: string
  category: string
}

const shoppingIntent = /(推荐|买|购买|找.*(?:同款|商品|灯|椅|桌|耳机|衣|鞋|包|护肤|家具)|选.*商品|挑.*商品|搭配|穿搭|适合.*(?:衣服|鞋|灯|家具|商品|护肤|耳机)|比较.*商品)/
const genericTerms = new Set(['商品', '推荐', '适合', '什么', '一下', '帮我', '给我', '选择', '搭配', '穿搭', '这个', '那个', '同款', '喜欢'])

export function catalogFallback(prompt: string, catalog: CatalogItem[], savedIds: string[], rejectedIds: string[]) {
  const query = prompt.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const request = /找|买|选|推荐/.exec(query)
  const target = request ? query.slice(request.index + request[0].length).split(/放在|放到|放|用于|搭配/)[0] : query
  const directProductQuery = query.length >= 2 && catalog.some((item) =>
    item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
  if (!shoppingIntent.test(prompt) && !directProductQuery) return null
  const rejected = new Set(rejectedIds)
  const savedCategories = new Set(catalog.filter((item) => savedIds.includes(item.id)).map((item) => item.category))
  const matches = catalog.filter((item) => !rejected.has(item.id)).map((item) => {
    const label = `${item.name}${item.category}`.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
    const terms = new Set(Array.from({ length: Math.max(0, label.length - 1) }, (_, index) => label.slice(index, index + 2)))
    const matched = [...terms].filter((term) => /\p{L}/u.test(term) && !genericTerms.has(term) && target.includes(term))
    const term = matched.sort((a, b) => target.lastIndexOf(b) - target.lastIndexOf(a))[0] || ''
    return { item, term, score: matched.length * 3 + (term ? target.lastIndexOf(term) / Math.max(1, target.length) : 0) + (savedCategories.has(item.category) ? 1 : 0) }
  }).filter(({ term }) => Boolean(term))
    .sort((a, b) => b.score - a.score).slice(0, 3)

  if (!matches.length) return {
    analysisText: '深入分析暂时不可用。当前资料不足以给出可靠的商品匹配，请补充具体用途或想找的物品。',
    styleTag: '', matchedProductIds: [], matchReasons: {},
  }

  return {
    analysisText: '深入分析暂时不可用。以下仅按你提到的物品从现有目录初步筛选；个人适配仍需进一步核对。',
    styleTag: '',
    matchedProductIds: matches.map(({ item }) => item.id),
    matchReasons: Object.fromEntries(matches.map(({ item, term }) => [item.id,
      `商品名称或类别与你提到的「${term}」相关，具体适配还需核对。`])),
  }
}
