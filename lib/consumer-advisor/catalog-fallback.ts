import { SEED_CATEGORIES } from '@/lib/product/categories'

type CatalogItem = {
  id: string
  name: string
  category: string
  description?: string
}

const shoppingIntent = /(推荐|买|购买|搜索|搜|查找|找|看看|想看|想要|浏览|挑|选购|有没有|哪款|几款|加入购物车|加购|购物车|add\s+to\s+cart|search|find|recommend|want to buy|looking for|找.*(?:同款|商品|灯|椅|桌|耳机|衣|鞋|包|护肤|家具)|选.*商品|挑.*商品|搭配|穿搭|适合.*(?:衣服|鞋|灯|家具|商品|护肤|耳机)|比较.*商品)/i
const genericTerms = new Set(['商品', '推荐', '适合', '什么', '一下', '帮我', '给我', '选择', '搭配', '穿搭', '这个', '那个', '同款', '喜欢'])

const jewelryRoot = SEED_CATEGORIES.find((category) => category.id === 'cat-jewelry-eyewear')
const jewelryCategories = SEED_CATEGORIES.filter((category) => category.id === jewelryRoot?.id || category.parentId === jewelryRoot?.id)
const jewelryTerms = [...new Set([
  '饰品', '首饰', '配饰', '珠宝配饰', 'jewelry', 'accessories',
  ...jewelryCategories.flatMap((category) => [category.name, category.nameEn, ...(category.keywords ?? [])]),
].filter((term): term is string => Boolean(term)))]
const categorySynonymGroups = [jewelryTerms]

function normalize(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function categoryAliasMatch(query: string, label: string) {
  for (const group of categorySynonymGroups) {
    if (!group.some((term) => query.includes(normalize(term)))) continue
    const match = group.find((term) => label.includes(normalize(term)))
    if (match) return normalize(match)
  }
  return ''
}

export function catalogFallback(prompt: string, catalog: CatalogItem[], savedIds: string[], rejectedIds: string[]) {
  const query = normalize(prompt)
  const request = /搜索|查找|找|买|选|推荐|search|find|buy|choose|recommend/.exec(query)
  const target = (request ? query.slice(request.index + request[0].length) : query)
    .split(/放在|放到|用于|搭配/)[0]
    .replace(/(?:预算(?:不超过|改成|调到|降低到|提高到|为|是)?|不超过|最多|控制在|上限)\d{2,6}(?:元|块)?/g, '')
    .replace(/(?:帮我|给我|想要|想看|看看|推荐|搜索|查找|找一个|找一款|买一个|买一款)/g, '')
  const directProductQuery = query.length >= 2 && catalog.some((item) =>
    normalize(`${item.name}${item.category}`).includes(query))
  const categoryQuery = catalog.some((item) => categoryAliasMatch(target, normalize(`${item.name}${item.category}${item.description ?? ''}`)))
  if (!shoppingIntent.test(prompt) && !directProductQuery && !categoryQuery) return null
  const rejected = new Set(rejectedIds)
  const savedCategories = new Set(catalog.filter((item) => savedIds.includes(item.id)).map((item) => item.category))
  const matches = catalog.filter((item) => !rejected.has(item.id)).map((item) => {
    const label = normalize(`${item.name}${item.category}${item.description ?? ''}`)
    const terms = new Set(Array.from({ length: Math.max(0, label.length - 1) }, (_, index) => label.slice(index, index + 2)))
    const matched = [...terms].filter((term) => /\p{L}/u.test(term) && !genericTerms.has(term) && target.includes(term))
    const term = matched.sort((a, b) => target.lastIndexOf(b) - target.lastIndexOf(a))[0] || categoryAliasMatch(target, label)
    return { item, term, score: matched.length * 3 + (term ? target.lastIndexOf(term) / Math.max(1, target.length) : 0) + (categoryAliasMatch(target, label) ? 8 : 0) + (savedCategories.has(item.category) ? 1 : 0) }
  }).filter(({ term }) => Boolean(term))
    .sort((a, b) => b.score - a.score).slice(0, 3)

  if (!matches.length) return {
    analysisText: '暂时没有找到直接匹配的商品。可以换一个品类或关键词再试。',
    styleTag: '', matchedProductIds: [], matchReasons: {},
  }

  return {
    analysisText: '目录里找到以下商品，结果按名称和类别初筛。请打开商品查看规格和详情。',
    styleTag: '',
    matchedProductIds: matches.map(({ item }) => item.id),
    matchReasons: Object.fromEntries(matches.map(({ item, term }) => [item.id,
      `商品名称或类别与你提到的「${term}」相关，具体适配还需核对。`])),
  }
}
