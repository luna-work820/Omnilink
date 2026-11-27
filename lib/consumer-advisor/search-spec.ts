import { getDiscoveryType, type ProductItem } from '@/components/consumer-market/types'
import { discoverySpecSchema, type DiscoverySpec } from './discovery-contract'
import { convertCurrency, type ExchangeRates } from './exchange-rates'
import { isDiscoveryPlaceholderImage } from './discovery-placeholder'
import { classifyProductKeyword, productModelFacts, stripSearchPrefix } from './product-keyword'

export const searchConcepts = [
  ['耳环', '耳饰', 'earring', 'earrings'], ['项链', 'necklace', 'necklaces'],
  ['手链', '手镯', 'bracelet', 'bracelets'], ['戒指', 'ring', 'rings'],
  ['沙发', 'sofa', 'couch'], ['椅子', '椅', 'chair'], ['桌子', '桌', 'table'],
] as const
const photographyConcepts = [
  ['相机','照相机','camera','cameras'],
  ['镜头','camera lens','camera lenses'],
  ['三脚架','tripod','tripods'],
  ['摄影器材','摄影设备','摄影装备','photography equipment','photographic equipment',
    '相机','照相机','camera','cameras','镜头','camera lens','camera lenses','三脚架','tripod','tripods'],
] as const
export const materialConcepts = [
  ['回收玻璃','再生玻璃','recycled glass'], ['黑玛瑙','black onyx'],
  ['再生银','回收银','recycled silver','recycled sterling silver'],
  ['925 纯银','925银','纯银','sterling silver','925 sterling silver'],
  ['镀金','gold plated','gold-plated','gold plating'], ['实金','solid gold'],
  ['淡水珍珠','freshwater pearl','freshwater pearls'], ['珍珠','pearl','pearls'],
  ['宝石','gemstone','gemstones'],
] as const

// These aliases are only used for filtering, so they do not change existing embedding documents.
const clothingConcepts = [
  ['连衣裙','dress','dresses'], ['半身裙','skirt','skirts'],
  ['裙子','裙装','连衣裙','dress','dresses','半身裙','skirt','skirts'],
  ['衬衫','shirt','shirts','blouse','blouses'], ['T恤','t-shirt','t-shirts','tee','tees'],
  ['卫衣','hoodie','hoodies','sweatshirt','sweatshirts'], ['毛衣','针织衫','sweater','sweaters','knitwear'],
  ['牛仔裤','jeans'], ['短裤','shorts'],
  ['高跟鞋','heels','high heels'], ['靴子','boots','boot'], ['运动鞋','sneakers','sneaker'],
  ['鞋子','鞋','shoes','shoe','footwear','高跟鞋','heels','靴子','boots','运动鞋','sneakers'],
  ['手提包','handbag','handbags'], ['背包','backpack','backpacks'],
  ['包包','包','bag','bags','handbag','handbags','backpack','backpacks'],
  ['围巾','scarf','scarves'], ['丝巾','silk scarf','silk scarves'],
  ['帽子','hat','hats','cap','caps'], ['袜子','socks','sock'], ['手套','gloves','glove'],
  ['腰带','belt','belts'], ['太阳镜','sunglasses'], ['连体衣','jumpsuit','jumpsuits'],
  ['睡衣','pajamas','pyjamas'], ['内衣','lingerie'],
  ['上衣','top','tops','shirt','shirts','blouse','blouses'],
  ['裤子','裤装','pants','trousers'], ['外套','jacket','jackets','coat','coats','blazer','blazers'],
  ['衣服','服装','服饰','clothes','clothing','apparel','连衣裙','dress','dresses','裙子','skirt','skirts',
    '上衣','top','tops','shirt','shirts','blouse','blouses','裤子','pants','trousers','外套','jacket','jackets','coat','coats','blazer','blazers',
    'T恤','t-shirt','t-shirts','tee','tees','毛衣','针织衫','sweater','sweaters','knitwear','卫衣','hoodie','hoodies','sweatshirt','sweatshirts'],
] as const
export const productCategoryConcepts = [...searchConcepts,...clothingConcepts,...photographyConcepts]
const clothingMaterials = [
  ['纯棉','100% cotton','100%棉'], ['棉','cotton'], ['亚麻','linen'], ['羊毛','wool'],
  ['丝绸','真丝','桑蚕丝','silk'], ['涤纶','聚酯纤维','polyester'], ['皮革','leather'],
] as const
const hardConcepts = [...searchConcepts,...materialConcepts,...clothingConcepts,...clothingMaterials,...photographyConcepts]

function matchesFilterTerm(text: string, term: string) {
  const normalized = term.normalize('NFKC').toLowerCase()
  const group = hardConcepts.find((words) => words.some((word) => word.toLowerCase() === normalized))
  return group ? group.some((word) => containsSearchTerm(text, word)) : containsSearchTerm(text, term)
}

function isHardConcept(group: string[]) {
  return group.some((term) => hardConcepts.some((words) => words.some((word) => word.toLowerCase() === term.normalize('NFKC').toLowerCase())))
}

function isCategoryTerm(term: string) {
  const normalized=term.normalize('NFKC').toLowerCase()
  return productCategoryConcepts.some((group)=>group.some((word)=>word.toLowerCase()===normalized))
}

export function searchableProductFacts(product:ProductItem) {
  return [product.name,product.category,product.shortDescription,product.storeName,
    ...Object.entries(product.specs??{}).filter(([key,value])=>
      /^(材质|材料|尺寸|颜色|工艺|制作地|产地|款式|形状|重量|material|size|colou?r|craft|origin|weight)$/i.test(key)
      && !/未核验|未提供|未知|待确认|unknown|unverified|not provided|https?:\/\//i.test(String(value)))
      .map(([key,value])=>key+': '+value)].join('\n').normalize('NFKC').trim()
}

export function productSearchText(product: ProductItem) {
  return [product.name, product.category, product.shortDescription, product.storeName,
    product.composition?.rawText,
    ...(product.composition?.items ?? []).map((item) => item.name),
    ...Object.entries(product.specs ?? {}).filter(([key])=>!/配送|运费|税费|核验|价格状态|库存状态|历史/.test(key)).map(([,value])=>value)].join(' ').replace(/https?:\/\/[^\s；，]+/gi,' ').normalize('NFKC').toLowerCase()
}

export function containsSearchTerm(text:string,term:string) {
  const normalized=term.normalize('NFKC').toLowerCase()
  if(!/[a-z0-9]/i.test(normalized)||/[^\x20-\x7e]/.test(normalized))return text.includes(normalized)
  const escaped=normalized.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`,'i').test(text)
}

export function matchesSearchConcept(text:string,term:string) {
  const concepts = [...searchConcepts,...materialConcepts]
  const group=concepts.find((group)=>group.some((word)=>word.toLowerCase()===term.normalize('NFKC').toLowerCase()))
  return group ? group.some((word)=>containsSearchTerm(text,word)) : containsSearchTerm(text,term)
}

/** Hard conditions are identical before recall, after fusion, and on every page. */
export function eligibleConsumerProduct(product: ProductItem, spec: DiscoverySpec, rates?: ExchangeRates | null) {
  if (isDiscoveryPlaceholderImage(product.mainImage)) return false
  const type = getDiscoveryType(product)
  if (type !== spec.type || spec.excludedProductIds?.includes(product.id)) return false
  if(spec.requireVerifiedDelivery&&!product.catalogEvidence?.verifiedDeliveryCountries?.includes(spec.deliveryCountry!))return false
  const text = productSearchText(product)
  const contains = (term: string) => matchesFilterTerm(text,term)
  const categoryText = [product.name,product.category].join(' ').normalize('NFKC').toLowerCase()
  const requiredGroups = [...spec.termGroups.filter(isHardConcept),...(spec.requiredTermGroups ?? [])]
  if (spec.categoryTerm && !matchesFilterTerm(categoryText,spec.categoryTerm)) return false
  if (spec.modelTerms?.length && !spec.modelTerms.every((term) => productModelFacts(product).includes(term))) return false
  if (!requiredGroups.every((group) => group.some((term)=>matchesFilterTerm(isCategoryTerm(term)?categoryText:text,term))) || spec.excludedTerms.some(contains)) return false
  if (spec.minPrice === null && spec.maxPrice === null) return true
  const mode = product.priceMode ?? 'unknown'
  if (mode !== 'free' && mode !== 'amount') return false
  const price = mode === 'free' ? 0 : convertCurrency(product.price,product.currency,spec.currency,rates)
  return price !== null && (spec.minPrice === null || price >= spec.minPrice)
    && (spec.maxPrice === null || price <= spec.maxPrice)
}

export function keywordSearchSpec(query: string, type: DiscoverySpec['type'] = '商品', catalog: readonly ProductItem[] = []): DiscoverySpec {
  const term = query.trim().normalize('NFKC').slice(0, 160)
  const match = classifyProductKeyword(term, catalog, productCategoryConcepts)
  const group = searchConcepts.find((synonyms) => synonyms.some((word) => word.toLowerCase() === term.toLowerCase()))
  return discoverySpecSchema.parse({query: term, type,
    termGroups: match ? [match.aliases] : group ? [[...group]] : [[term]],
    ...(match?.categoryTerm ? {categoryTerm: match.categoryTerm, requiredTermGroups: [[match.categoryTerm]]} : {}),
    ...(match?.modelTerms ? {modelTerms: match.modelTerms} : {}),
    ...(match && !match.categoryTerm && !match.modelTerms ? {requiredTermGroups: [[match.term]]} : {}),
    retrieval: {mode: 'keyword'}})
}

export function simpleProductSearchSpec(prompt: string, type: DiscoverySpec['type'] = '商品', catalog: readonly ProductItem[] = []): DiscoverySpec | null {
  const text=prompt.trim().normalize('NFKC').replace(/[。！!]+$/,'').trim()
  const styles = [
    { pattern: /^(?:复古|vintage|retro)(?:风(?:格)?)?\s*(?:的)?\s*/i, terms: ['复古','vintage','retro'] },
    { pattern: /^(?:clean|简约|极简)(?:风(?:格)?)?\s*(?:的)?\s*/i, terms: ['clean','简约','minimal'] },
    { pattern: /^(?:哥特|gothic|goth)(?:风(?:格)?)?\s*(?:的)?\s*/i, terms: ['哥特','gothic','goth'] },
  ]
  for (const style of styles) {
    const match = style.pattern.exec(text)
    if (!match) continue
    const category = text.slice(match[0].length).trim()
    if ([...clothingConcepts,...searchConcepts.slice(0,4)].some((group) => group.some((word) => word.toLowerCase() === category.toLowerCase()))) {
      return discoverySpecSchema.parse({query:text,type,termGroups:[style.terms,[category]],sessionTerms:style.terms,retrieval:{mode:'auto'}})
    }
  }
  const match = classifyProductKeyword(text, catalog, productCategoryConcepts)
  if (!match) return null
  const displayTerm = stripSearchPrefix(text) || text
  return discoverySpecSchema.parse({query: displayTerm.slice(0, 160), type,
    termGroups: [match.aliases],
    ...(match.categoryTerm ? {categoryTerm: match.categoryTerm, requiredTermGroups: [[match.categoryTerm]]} : {}),
    ...(match.modelTerms ? {modelTerms: match.modelTerms} : {}),
    ...(!match.categoryTerm && !match.modelTerms ? {requiredTermGroups: [[match.term]]} : {}),
    retrieval: {mode: 'keyword'}})
}

export function keywordProductScore(product:ProductItem,spec:DiscoverySpec,positive:string[]=[],avoid:string[]=[]) {
    const text = productSearchText(product), title = product.name.toLowerCase()
    return spec.termGroups.filter((group) => group.some((term) => matchesFilterTerm(title,term))).length * 4
      + spec.sessionTerms.filter((term) => matchesFilterTerm(text,term)).length * 2
      + positive.filter((term) => matchesFilterTerm(text,term)).length * 0.1
      - avoid.filter((term) => matchesFilterTerm(text,term)).length * 0.1
}
export function rankKeywordProducts(products: ProductItem[], spec: DiscoverySpec, positive: string[] = [], avoid: string[] = [], rates?: ExchangeRates | null, requireKeywords = true) {
  return products.filter((product) => eligibleConsumerProduct(product, spec, rates) && (!requireKeywords ||
    spec.termGroups.every((group) => group.some((term) => matchesFilterTerm(productSearchText(product),term)))))
    .map((product, position) => ({product, position, score: keywordProductScore(product,spec,positive,avoid)}))
    .sort((a, b) => b.score - a.score || a.position - b.position).map(({product}) => product)
}

export function spreadStores(products:ProductItem[],score:(product:ProductItem)=>number,tolerance=0) {
  const result:ProductItem[]=[],counts=new Map<string,number>()
  for(let offset=0;offset<products.length;) {
    const first=score(products[offset]),group:ProductItem[]=[products[offset++]]
    while(offset<products.length&&group.length<8&&Math.abs(first-score(products[offset]))<=tolerance)group.push(products[offset++])
    while(group.length) {
      let index=0
      for(let i=1;i<group.length;i++)if((counts.get(group[i].storeSlug??group[i].storeName)??0)<(counts.get(group[index].storeSlug??group[index].storeName)??0))index=i
      const product=group.splice(index,1)[0],store=product.storeSlug??product.storeName
      result.push(product);counts.set(store,(counts.get(store)??0)+1)
    }
  }
  return result
}

export function fuseProductIds(lists: string[][]) {
  const scores = new Map<string, number>()
  for (const list of lists) [...new Set(list)].forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (61 + rank)))
  return [...scores].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}
