import ingredientIndex from './ingredient-index.json'

type Ingredient = {
  name: string
  cosingId: string
  cas: string
  ec: string
  pubchemId: string
  historicalFunction?: string
  historicalAnnexes?: string[]
}

const ingredients = ingredientIndex as Ingredient[]
const annexLabels: Record<string, string> = {
  II: 'Annex II', III: 'Annex III', IV: 'Annex IV', V: 'Annex V', VI: 'Annex VI',
}

function findIngredients(query: string) {
  const normalized = query.toLocaleLowerCase('en').replace(/\s+/g, ' ')
  const matches = ingredients.flatMap((item) => {
    const name = item.name.toLocaleLowerCase('en')
    const hits: Array<{ item: Ingredient; start: number; end: number }> = []
    if (name.length >= 4) {
      let start = normalized.indexOf(name)
      while (start >= 0) {
        const end = start + name.length
        if ((start === 0 || !/[a-z]/.test(normalized[start - 1])) &&
          (end === normalized.length || !/[a-z]/.test(normalized[end]))) {
          hits.push({ item, start, end })
        }
        start = normalized.indexOf(name, start + 1)
      }
    }
    return hits.length ? hits : item.cas && normalized.includes(item.cas)
      ? [{ item, start: -1, end: -1 }]
      : []
  }).sort((a, b) => b.item.name.length - a.item.name.length)

  const selected: typeof matches = []
  const seen = new Set<Ingredient>()
  for (const match of matches) {
    if (seen.has(match.item) || selected.some((item) =>
      match.start >= 0 && item.start >= 0 && match.start >= item.start && match.end <= item.end)) continue
    selected.push(match)
    seen.add(match.item)
    if (selected.length === 3) break
  }
  return selected.map(({ item }) => item)
}

export function lookupIngredientInfo(query: string) {
  const matches = findIngredients(query)
  if (!matches.length) {
    return {
      text: '这批资料里没有识别到明确的成分名称。请提供包装上的英文 INCI 名称或 CAS 号；仅凭中文俗名或照片无法可靠匹配。',
      styleTag: '成分资料检索',
    }
  }

  const entries = matches.map((item) => {
    const identifiers = [item.cosingId && `CosIng ID ${item.cosingId}`, item.cas && `CAS ${item.cas}`, item.ec && `EC ${item.ec}`, item.pubchemId && `PubChem ${item.pubchemId}`].filter(Boolean).join('；')
    const functionText = item.historicalFunction ? `；2016 年 CosIng 功能字段：${item.historicalFunction}` : ''
    const annexText = item.historicalAnnexes?.length
      ? `；历史 Annex 表中按 CAS 命中 ${item.historicalAnnexes.map((annex) => annexLabels[annex]).join('、')}，需核对现行原文和适用条件`
      : ''
    return `${item.name}：${identifiers || '无补充标识'}${functionText}${annexText}。`
  })

  return {
    text: `${entries.join(' ')} 来源：BEAUTEE Cosmetic Ingredients Dataset (Lite)；Open Beauty Facts 仓库 CosIng 历史资料（功能字段来自 2016 年清单）。这里仅提供名称、标识与历史索引，不能据此判断某人是否适用、产品是否安全或符合现行法规。`,
    styleTag: '成分资料检索',
  }
}
