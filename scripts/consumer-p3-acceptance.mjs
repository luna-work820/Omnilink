import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
import {createServer} from 'vite'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const localBge=process.argv.includes('--local-bge')
const outputArg=process.argv.indexOf('--output')
const output=outputArg<0?'/tmp/omnilink-p3':path.resolve(process.argv[outputArg+1])
const server=await createServer({root,configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':root}},
  server:{middlewareMode:true,watch:{ignored:['**/*']}},plugins:[{name:'p3-server-only',
    resolveId(id){if(id==='server-only')return '\0p3-server-only'},load(id){if(id==='\0p3-server-only')return 'export {}'}}]})
try {
  const {readConsumerCatalog}=await server.ssrLoadModule('/lib/products/consumer-catalog.ts')
  const {discoverySpecSchema}=await server.ssrLoadModule('/lib/consumer-advisor/discovery-contract.ts')
  const {eligibleConsumerProduct,keywordSearchSpec}=await server.ssrLoadModule('/lib/consumer-advisor/search-spec.ts')
  const {retrieveDiscoveryCandidates}=await server.ssrLoadModule('/lib/consumer-advisor/discovery-retrieval.ts')
  const products=readConsumerCatalog()
  const report={catalogSize:products.length,paidModelCalls:0,keyword:[],hardConstraints:null,localBge:null}
  for(const [zh,en] of [['耳环','earrings'],['项链','necklace'],['戒指','rings']]) {
    const a=await retrieveDiscoveryCandidates(keywordSearchSpec(zh)),b=await retrieveDiscoveryCandidates(keywordSearchSpec(en))
    report.keyword.push({queries:[zh,en],counts:[a.products.length,b.products.length],sameOrder:JSON.stringify(a.products.map(p=>p.id))===JSON.stringify(b.products.map(p=>p.id)),embeddingCalls:a.report.embeddingCalls+b.report.embeddingCalls})
  }
  const budget=discoverySpecSchema.parse({query:'100 美元以内的耳环，不要珍珠',termGroups:[['耳环','耳饰','earring','earrings']],excludedTerms:['珍珠','pearl'],maxPrice:100,currency:'USD'})
  const matches=await retrieveDiscoveryCandidates(budget)
  const expected=['external-amano-2-silver-hoop-earrings','external-amano-1-5-classic-hoops','external-amano-honey-bee-studs-1','external-amano-star-cluster-studs','external-cled-petal-icon-stud-earrings','external-amano-1-5-hammered-hoop-earrings']
  const actual=matches.products.map(p=>p.id)
  const shipping=await retrieveDiscoveryCandidates({...keywordSearchSpec('耳环'),deliveryCountry:'CN',requireVerifiedDelivery:true})
  report.hardConstraints={evidence:'Explicit golden Search Spec, not a live language-parser call',expected,actual,exactMatch:JSON.stringify([...expected].sort())===JSON.stringify([...actual].sort()),verifiedChinaDeliveryCount:shipping.products.length,embeddingCalls:matches.report.embeddingCalls+shipping.report.embeddingCalls}
  if(!report.hardConstraints.exactMatch||shipping.products.length)process.exitCode=1
  if(localBge) {
    const {embeddingProfiles}=await server.ssrLoadModule('/lib/consumer-advisor/embedding-profile.ts')
    const {embedConsumerTexts}=await server.ssrLoadModule('/lib/consumer-advisor/embedding-provider.ts')
    const {productEmbeddingDocument}=await server.ssrLoadModule('/lib/consumer-advisor/consumer-catalog-vector.ts')
    const profile=embeddingProfiles['bge-small-zh-v1.5-512-v1'],documents=products.map((product)=>productEmbeddingDocument(product,profile))
    const documentVectors=[],timings=[]
    let calls=0
    for(let offset=0;offset<documents.length;offset+=24) {
      const embedded=await embedConsumerTexts(profile,documents.slice(offset,offset+24).map(d=>d.text),'document')
      documentVectors.push(...embedded.vectors);calls+=embedded.calls;timings.push({stage:'documents',count:embedded.vectors.length,ms:embedded.durationMs})
    }
    const cases=[
      {queries:['小蜜蜂耳钉','tiny honey bee stud earrings'],category:'耳环',expected:['external-amano-honey-bee-studs-1']},
      {queries:['回收玻璃花瓣耳钉','recycled glass petal stud earrings'],category:'耳环',expected:['external-cled-petal-icon-stud-earrings']},
      {queries:['黑玛瑙银耳饰','silver earrings with black onyx'],category:'耳环',expected:['external-leap-quiet-grace-onyx-earrings','external-leap-between-stillness-earrings']},
      {queries:['镶宝石的再生银戒指','recycled silver gemstone ring'],category:'戒指',expected:['external-berhel-liquid-band-ring-with-gemstones']},
      {queries:['镶淡水珍珠的戒指','ring with freshwater pearl'],category:'戒指',expected:['external-leap-ebb-and-flow-ring']},
      {queries:['螺旋吊坠项链','spiral pendant necklace'],category:'项链',expected:['external-leap-spiral-necklace']},
    ]
    const queries=cases.flatMap(c=>c.queries),queryResult=await embedConsumerTexts(profile,queries,'query')
    calls+=queryResult.calls;timings.push({stage:'queries',count:queries.length,ms:queryResult.durationMs})
    const cosine=(a,b)=>{
      let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}
      return dot/Math.sqrt(aa*bb)
    }
    const vectorsById=new Map(documents.map((d,i)=>[d.key,documentVectors[i]]))
    const results=[]
    for(let i=0;i<queries.length;i++) {
      const test=cases[Math.floor(i/2)],spec={...keywordSearchSpec(test.category),query:queries[i]}
      const ranked=products.filter(p=>eligibleConsumerProduct(p,spec)).map(p=>({id:p.id,name:p.name,score:cosine(queryResult.vectors[i],vectorsById.get(p.id))})).sort((a,b)=>b.score-a.score)
      const expectedRanks=test.expected.map(id=>({id,rank:ranked.findIndex(p=>p.id===id)+1}))
      results.push({query:queries[i],language:i%2?'en':'zh',candidateCount:ranked.length,expectedRanks,hitAt3:expectedRanks.some(p=>p.rank>0&&p.rank<=3),top5:ranked.slice(0,5)})
    }
    const budget=discoverySpecSchema.parse({query:'earrings under USD 100',termGroups:[['earring','earrings','耳环','耳饰']],maxPrice:100,currency:'USD'})
    const budgetRows=products.filter(p=>eligibleConsumerProduct(p,budget))
    report.localBge={profile,calls,timings,results,budget:{count:budgetRows.length,allRespectBudget:budgetRows.every(p=>p.priceMode==='amount'&&p.currency==='USD'&&p.price<=100)},
      summary:{zhHitsAt3:results.filter(r=>r.language==='zh'&&r.hitAt3).length,enHitsAt3:results.filter(r=>r.language==='en'&&r.hitAt3).length,pairs:cases.length}}
    await mkdir(output,{recursive:true})
    await writeFile(path.join(output,'local-bge-vectors.json'),JSON.stringify({profile,documents:documents.map((d,i)=>({key:d.key,hash:d.hash,vector:documentVectors[i]})),queries:queries.map((query,i)=>({query,vector:queryResult.vectors[i]}))}))
  }
  await mkdir(output,{recursive:true})
  await writeFile(path.join(output,'retrieval-acceptance.json'),JSON.stringify(report,null,2))
  console.log(JSON.stringify({output,catalogSize:products.length,paidModelCalls:0,keyword:report.keyword,hardConstraints:report.hardConstraints,localBge:report.localBge?.summary??'not run',timings:report.localBge?.timings??[]},null,2))
}finally{await server.close()}
