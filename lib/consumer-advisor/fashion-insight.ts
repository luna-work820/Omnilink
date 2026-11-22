import type { ProductItem } from '@/components/consumer-market/types'
import { containsSearchTerm, searchableProductFacts } from './search-spec'
import type { DiscoverySpec } from './discovery-contract'

const dimensions = {
  style: { prompt: '你更喜欢哪种风格？', options: [
    ['vintage','复古',['复古','vintage','retro']], ['minimal','简约',['简约','minimal','minimalist']],
    ['gothic','哥特',['哥特','gothic']], ['french','法式',['法式','french']],
    ['chinese','中式',['中式','chinese style']], ['classic','经典',['经典','classic']],
  ] },
  color: { prompt: '你更喜欢什么颜色？', options: [
    ['black','黑色',['黑色','black']], ['white','白色',['白色','white','ivory']],
    ['red','红色',['红色','red']], ['blue','蓝色',['蓝色','blue']],
    ['brown','棕色',['棕色','brown']], ['silver','银色',['银色','silver color']], ['gold','金色',['金色','gold color']],
  ] },
  material: { prompt: '你更喜欢什么材质？', options: [
    ['cotton','棉',['棉','cotton']], ['linen','亚麻',['亚麻','linen']], ['silk','真丝',['真丝','silk']],
    ['wool','羊毛',['羊毛','wool']], ['silver-material','银',['纯银','sterling silver']],
    ['gold-material','金',['黄金','solid gold']], ['leather','皮革',['皮革','leather']],
  ] },
} satisfies Record<string,{prompt:string;options:[string,string,string[]][]}>

export type InsightOption = { value:string; label:string; terms:string[] }
export type InsightQuestion = { prompt:string; options:InsightOption[] }
export function fashionCandidates(products:ProductItem[],spec:DiscoverySpec) {
  const query=[spec.query,...spec.sessionTerms].join(' ').toLowerCase()
  const facts=products.map((p)=>searchableProductFacts(p).replace(/https?:\/\/\S+/g,' ').toLowerCase())
  return Object.entries(dimensions).flatMap(([id,dimension])=>{
    const options=dimension.options.flatMap(([value,label,terms])=>{
      if(terms.some((term)=>containsSearchTerm(query,term)))return []
      const count=facts.filter((text)=>terms.some((term)=>containsSearchTerm(text,term))).length
      return count ? [{value,label,terms,count}] : []
    })
    return options.length>=2?[{id,prompt:dimension.prompt,options}]:[]
  })
}
export function validateInsightChoice(raw:string,candidates:ReturnType<typeof fashionCandidates>):InsightQuestion|null {
  try {
    const parsed=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,'')) as {dimension?:unknown;options?:unknown}
    const dimension=candidates.find((item)=>item.id===parsed.dimension)
    if(!dimension||!Array.isArray(parsed.options))return null
    const ids=[...new Set(parsed.options.filter((value):value is string=>typeof value==='string'))]
    const options=ids.flatMap((id)=>{const option=dimension.options.find((item)=>item.value===id);return option?[{value:option.value,label:option.label,terms:option.terms}]:[]}).slice(0,3)
    return options.length>=2?{prompt:dimension.prompt,options}:null
  } catch { return null }
}
