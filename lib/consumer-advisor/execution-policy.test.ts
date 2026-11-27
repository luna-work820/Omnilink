import { describe,expect,it } from 'vitest'
import { ruleConsumerExecution,consumerActionSchema } from './execution-policy'
import { readConsumerCatalog } from '@/lib/products/consumer-catalog'
const input={hasImage:false,hasDocument:false,hasSelectedProducts:false,hasSources:false}
describe('deterministic execution policy',()=>{
  it.each([['耳环','product-search'],['earrings','product-search'],['比较这两款','comparison'],['compare these','comparison'],['https://example.com/product','comparison']])('routes %s without classification', (prompt,intent)=>{
    expect(ruleConsumerExecution({...input,prompt})?.intent).toBe(intent)
  })
  it.each(['裙子','连衣裙','dress','半身裙','一条裙子','帮我找一条裙子','上衣','裤子','外套','运动鞋','背包','围巾','袜子','摄影器材','摄影设备','相机','镜头','三脚架'])('routes the product keyword %s directly to keyword retrieval',prompt=>{
    const decision=ruleConsumerExecution({...input,prompt})
    expect(decision?.intent).toBe('product-search')
    expect(decision?.search?.retrieval?.mode).toBe('keyword')
  })
  it.each([
    ['复古衣服','衣服','复古'],
    ['复古风连衣裙','连衣裙','复古'],
    ['clean风衬衫','衬衫','clean'],
    ['哥特裙子','裙子','哥特'],
    ['复古耳环','耳环','复古'],
    ['clean风项链','项链','clean'],
    ['哥特戒指','戒指','哥特'],
  ])('routes a short style and product phrase %s without a model', (prompt, category, style) => {
    const decision=ruleConsumerExecution({...input,prompt})
    expect(decision).toMatchObject({intent:'product-search',search:{query:prompt,termGroups:[expect.arrayContaining([style]),[category]],retrieval:{mode:'auto'}}})
  })
  it('leaves qualified style searches to the parser so constraints are not dropped',()=>{
    for(const prompt of ['不要复古衣服','复古衣服适合我吗','复古衣服500元以内','复古衣服但不要棉']) {
      expect(ruleConsumerExecution({...input,prompt})).toBeNull()
    }
  })
  it('does not treat questions or multi-condition requests as a single product keyword',()=>{
    for(const prompt of ['裙子适合我吗','我喜欢裙子','黑色连衣裙','不要裙子','裙子 500元以内']) {
      expect(ruleConsumerExecution({...input,prompt})).toBeNull()
    }
  })
  it('recognizes a single word already present in a published product without a parser',()=>{
    const catalogProducts=[{...readConsumerCatalog()[0],name:'Striped halter dress',category:'连衣裙',specs:{}}]
    expect(ruleConsumerExecution({...input,prompt:'halter',catalogProducts})).toMatchObject({intent:'product-search',search:{query:'halter',retrieval:{mode:'keyword'}}})
  })
  it('recognizes an existing brand and model without a classifier',()=>{
    const catalogProducts=[{...readConsumerCatalog()[0],name:'Canon R5 camera body',category:'相机',specs:{}}]
    expect(ruleConsumerExecution({...input,prompt:'Canon R5',catalogProducts})).toMatchObject({intent:'product-search',search:{query:'Canon R5',retrieval:{mode:'keyword'}}})
  })
  it.each(['摄影器材怎么选？','摄影器材评测文章','适合旅行的轻便相机','相机1000元以内'])('does not treat a qualified request as a bare keyword: %s',prompt=>{
    expect(ruleConsumerExecution({...input,prompt})).toBeNull()
  })
  it('leaves an ambiguous natural-language request to the single parser',()=>{
    expect(ruleConsumerExecution({...input,prompt:'I need something delicate for a wedding, under 100 USD'})).toBeNull()
    expect(ruleConsumerExecution({...input,prompt:'推荐一些适合婚礼的精致耳环，100美元以内'})).toBeNull()
  })
  it('switches explicit simple requests independently of the previous browsing scope',()=>{
    expect(ruleConsumerExecution({...input,scope:'service',prompt:'找耳环资料'})).toMatchObject({intent:'information-search',search:{query:'耳环',type:'数字'}})
    expect(ruleConsumerExecution({...input,scope:'information',prompt:'帮我买耳环'})).toMatchObject({intent:'product-search',search:{query:'耳环',type:'商品'}})
    expect(ruleConsumerExecution({...input,scope:'information',prompt:'找摄影服务'})).toMatchObject({intent:'product-search',search:{query:'摄影',type:'服务'}})
  })
  it('leaves qualified resource requests to the parser',()=>{
    for(const prompt of ['找最近的耳环资料','找200元以内的摄影服务','找适合婚礼的摄影服务']) {
      expect(ruleConsumerExecution({...input,prompt})).toBeNull()
    }
  })
  it('does not swallow a new search or a request for personal suitability behind a product reference',()=>{
    for(const prompt of ['这款适合我平时的穿搭吗','这款不要了，帮我找100美元以内的项链']) {
      expect(ruleConsumerExecution({...input,hasSelectedProducts:true,prompt})).toBeNull()
    }
    expect(ruleConsumerExecution({...input,hasSelectedProducts:true,prompt:'这件的材质是什么？'})).toMatchObject({intent:'product-question',needsPersonalContext:false})
  })
  it('keeps a structured operation independent of the text classifier',()=>{
    const action=consumerActionSchema.parse({type:'keyword',query:'CLED'})
    expect(ruleConsumerExecution({...input,prompt:'',action})).toMatchObject({intent:'product-search',search:{query:'CLED',termGroups:[['CLED']]}})
  })
})
