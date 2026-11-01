import ingredientIndex from '@/lib/consumer-advisor/ingredient-index.json'

export const runtime = 'nodejs'

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
  return ingredients
    .filter((item) => {
      const name = item.name.toLocaleLowerCase('en')
      const start = normalized.indexOf(name)
      const nameMatch = name.length >= 4 && start >= 0 &&
        (start === 0 || !/[a-z]/.test(normalized[start - 1])) &&
        (start + name.length === normalized.length || !/[a-z]/.test(normalized[start + name.length]))
      return nameMatch || Boolean(item.cas && normalized.includes(item.cas))
    })
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, 3)
}

export async function POST(request: Request) {
  let query: unknown
  try {
    query = (await request.json()).query
  } catch {
    return Response.json({ error: '请求格式无效。' }, { status: 400 })
  }
  if (typeof query !== 'string' || !query.trim() || query.length > 500) {
    return Response.json({ error: '请输入 500 字以内的成分问题。' }, { status: 400 })
  }

  const matches = findIngredients(query)
  if (!matches.length) {
    return Response.json({
      text: '这批资料里没有识别到明确的成分名称。请提供包装上的英文 INCI 名称或 CAS 号；仅凭中文俗名或照片无法可靠匹配。',
      styleTag: '成分资料检索',
    })
  }

  const entries = matches.map((item) => {
    const identifiers = [item.cosingId && `CosIng ID ${item.cosingId}`, item.cas && `CAS ${item.cas}`, item.ec && `EC ${item.ec}`, item.pubchemId && `PubChem ${item.pubchemId}`].filter(Boolean).join('；')
    const functionText = item.historicalFunction ? `；2016 年 CosIng 功能字段：${item.historicalFunction}` : ''
    const annexText = item.historicalAnnexes?.length
      ? `；历史 Annex 表中按 CAS 命中 ${item.historicalAnnexes.map((annex) => annexLabels[annex]).join('、')}，需核对现行原文和适用条件`
      : ''
    return `${item.name}：${identifiers || '无补充标识'}${functionText}${annexText}。`
  })

  return Response.json({
    text: `${entries.join(' ')} 来源：BEAUTEE Cosmetic Ingredients Dataset (Lite)；Open Beauty Facts 仓库 CosIng 历史资料（功能字段来自 2016 年清单）。这里仅提供名称、标识与历史索引，不能据此判断某人是否适用、产品是否安全或符合现行法规。`,
    styleTag: '成分资料检索',
  })
}
