import { describe,expect,it } from 'vitest'
import type { ProductItem } from '@/components/consumer-market/types'
import { discoverySpecSchema } from './discovery-contract'
import { fashionCandidates,validateInsightChoice } from './fashion-insight'

const spec=discoverySpecSchema.parse({query:'复古裙子',termGroups:[['裙子','dress']],type:'商品'})
const product=(id:string,name:string,description='')=>({id,name,category:'dress',shortDescription:description,storeName:'test',specs:{}} as ProductItem)
describe('fashion insight candidates',()=>{
  it('uses evidence from viewed products, excludes the existing preference and supports accessories',()=>{
    const candidates=fashionCandidates([product('1','Vintage Black Dress','cotton'),product('2','Vintage White Necklace','sterling silver')],spec)
    expect(candidates.find((x)=>x.id==='color')?.options.map((x)=>x.value)).toEqual(['black','white'])
    expect(candidates.find((x)=>x.id==='material')?.options.map((x)=>x.value)).toEqual(['cotton','silver-material'])
    expect(candidates.flatMap((x)=>x.options.map((o)=>o.value))).not.toContain('vintage')
  })
  it('does not invent unsupported options or trust model-generated wording',()=>{
    const candidates=fashionCandidates([product('1','Black dress'),product('2','White dress')],spec)
    expect(validateInsightChoice('{"dimension":"color","options":["black","invented"]}',candidates)).toBeNull()
    expect(validateInsightChoice('{"dimension":"color","options":["black","white"],"prompt":"invented"}',candidates)).toEqual({prompt:'你更喜欢什么颜色？',options:[{value:'black',label:'黑色',terms:['黑色','black']},{value:'white',label:'白色',terms:['白色','white','ivory']}]})
  })
  it('does not treat URLs or unsupported metadata as product attributes',()=>{
    expect(fashionCandidates([product('1','Dress','https://example.com/black'),product('2','White dress')],spec)).toEqual([])
  })
})
