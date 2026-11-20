import { z } from 'zod'
import { discoverySpecSchema, type DiscoverySpec } from './discovery-contract'

export const searchScopeSchema = z.enum(['product', 'service', 'information'])
export type SearchScope = z.infer<typeof searchScopeSchema>
const fields = discoverySpecSchema.shape
export const searchPatchSchema = z.object({
  query: fields.query.optional(), termGroups: fields.termGroups.optional(), requiredTermGroups: fields.termGroups.optional(),
  addTermGroups:fields.termGroups.optional(),
  excludedTerms: z.array(z.string().trim().min(1).max(48)).max(10).optional(), minPrice: z.number().nonnegative().max(1e9).nullable().optional(),
  maxPrice: z.number().nonnegative().max(1e9).nullable().optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  type: z.enum(['商品','服务','数字']).optional(), sessionTerms:z.array(z.string().trim().min(1).max(48)).max(8).optional(),
  deliveryCountry: z.string().regex(/^[A-Z]{2}$/).nullable().optional(),
  requireVerifiedDelivery: z.boolean().optional(),
}).strict()
export type SearchPatch = z.infer<typeof searchPatchSchema>

export function applySearchPatch(previous: DiscoverySpec, input: SearchPatch): DiscoverySpec {
  const patch = searchPatchSchema.parse(input)
  const {addTermGroups,...changes}=patch
  const groups=changes.termGroups??previous.termGroups
  const termGroups=[...new Map([...groups,...(addTermGroups??[])].map((group)=>[JSON.stringify(group),group])).values()]
  let requiredGroups=changes.requiredTermGroups??previous.requiredTermGroups??[]
  const previousCategory=previous.categoryTerm?.normalize('NFKC').toLowerCase()
  const categoryRetained=previousCategory && termGroups.some((group)=>group.some((term)=>term.normalize('NFKC').toLowerCase()===previousCategory))
  if(previousCategory && !categoryRetained && changes.requiredTermGroups===undefined) {
    requiredGroups=requiredGroups.filter((group)=>!group.some((term)=>term.normalize('NFKC').toLowerCase()===previousCategory))
  }
  const requiredTermGroups=[...new Map([...requiredGroups,...(addTermGroups??[])].map((group)=>[JSON.stringify(group),group])).values()]
  const excludedTerms=changes.excludedTerms?.length?[...new Set([...previous.excludedTerms,...changes.excludedTerms])]:changes.excludedTerms??previous.excludedTerms
  const next = {...previous, ...changes, termGroups,requiredTermGroups,excludedTerms,questionDismissed: true,
    deliveryCountry: patch.deliveryCountry === null ? undefined : patch.deliveryCountry ?? previous.deliveryCountry}
  if(previousCategory && !categoryRetained) next.categoryTerm=undefined
  if (patch.deliveryCountry === null) next.requireVerifiedDelivery = false
  if (patch.query === undefined) {
    next.query = [...next.termGroups.map((group) => group[0]), ...next.sessionTerms].join(' ').slice(0,160) || (next.type==='服务'?'全部服务':'全部商品')
  }
  return discoverySpecSchema.parse(next)
}

const colors = [['金色','gold','golden'], ['银色','silver'], ['黑色','black'], ['白色','white'],
  ['红色','red'], ['蓝色','blue'], ['绿色','green']] as const

export function hasRuleSearchPatch(prompt:string) {
  return ruleSearchPatch(prompt, discoverySpecSchema.parse({query:'previous',termGroups:[]})) !== null
}

// Only complete, bounded edits are rules. A longer sentence still goes to the single parser.
export function ruleSearchPatch(prompt: string, previous: DiscoverySpec): SearchPatch | null {
  const text = prompt.trim().replace(/[。！.!？?]+$/, '').trim()
  if (/^(取消预算|不限预算|价格不限|不限制价格|remove (?:the )?(?:price limit|budget)|no (?:price limit|budget limit))$/i.test(text)) {
    return {minPrice:null, maxPrice:null}
  }
  if (/^(取消排除条件|清除排除条件|remove (?:all )?exclusions)$/i.test(text)) return {excludedTerms:[]}
  for (const group of colors) {
    const words = group.join('|')
    if (new RegExp('^(?:(?:换成?|改成?|只看|只要)(?:为)?|(?:change (?:them |it )?to |make (?:them |it )?|only ))(' + words + ')$', 'i').test(text)) {
      const colorWords: readonly string[] = colors.flat()
      return {termGroups:[...previous.termGroups.filter((terms) => !terms.every((term) => colorWords.includes(term.toLowerCase()))), [...group]],
        requiredTermGroups:[...(previous.requiredTermGroups??[]).filter((terms) => !terms.every((term) => colorWords.includes(term.toLowerCase()))), [...group]],
        sessionTerms:previous.sessionTerms.filter((term) => !colorWords.includes(term.toLowerCase()))}
    }
  }
  const budget = /^(?:(?:预算)?(?:改为|改成|调整到|换成)?\s*)?(\d+(?:\.\d+)?)\s*(美元|美金|USD|欧元|EUR|人民币|元|CNY)?\s*(?:以内|以下|封顶)$/i.exec(text)
    ?? /^(?:under|up to|max(?:imum)?|budget(?: of)?)\s*(USD|EUR|CNY|\$|€|¥)?\s*(\d+(?:\.\d+)?)$/i.exec(text)
  if (budget) {
    const chinese = /^\d/.test(budget[1]), amount = Number(chinese ? budget[1] : budget[2])
    const unit = (chinese ? budget[2] : budget[1])?.toUpperCase()
    const currency = unit && (/美元|美金|USD|\$/.test(unit) ? 'USD' : /欧元|EUR|€/.test(unit) ? 'EUR' : 'CNY')
    return {maxPrice:amount,...(currency ? {currency} : {})}
  }
  return null
}
