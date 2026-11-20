import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {mkdir,writeFile} from 'node:fs/promises'
import {createServer} from 'vite'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const local=process.argv.includes('--local-bge')
const outputArg=process.argv.indexOf('--output')
const output=outputArg<0?'/tmp/omnilink-search-optimization':path.resolve(process.argv[outputArg+1])
const server=await createServer({root,configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':root}},
  server:{middlewareMode:true,watch:{ignored:['**/*']}},plugins:[{name:'benchmark-server-only',resolveId(id){if(id==='server-only')return '\0benchmark-server-only'},load(id){if(id==='\0benchmark-server-only')return 'export {}'}}]})
const percentile=(values,p)=>values.length?[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]:null
const cosine=(a,b)=>{
  let dot=0,aa=0,bb=0
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}
  return dot/Math.sqrt(aa*bb)
}
try {
  const load=(file)=>server.ssrLoadModule('/lib/consumer-advisor/'+file+'.ts')
  const {readConsumerCatalog,CONSUMER_CATALOG_VERSION}=await server.ssrLoadModule('/lib/products/consumer-catalog.ts')
  const {searchBenchmarkCases}=await load('search-benchmark-cases')
  const {keywordSearchSpec,eligibleConsumerProduct}=await load('search-spec')
  const {retrieveDiscoveryCandidates}=await load('discovery-retrieval')
  const {embeddingProfiles}=await load('embedding-profile')
  const {productEmbeddingDocument}=await load('consumer-catalog-vector')
  const {embedConsumerTexts}=await load('embedding-provider')
  const catalog=readConsumerCatalog(),ids=new Set(catalog.map((p)=>p.id))
  if(searchBenchmarkCases.some((test)=>test.expected.some((id)=>!ids.has(id))))throw new Error('评测目标不在当前真实目录。')
  const rows=[],vectors=[],builds=[]
  const profiles=local?['bge-small-zh-v1.5-512-v1','bge-small-zh-v1.5-512-v2']:['bge-small-zh-v1.5-512-v2']
  for(const profileId of profiles) {
    const profile=embeddingProfiles[profileId],documents=catalog.map((p)=>productEmbeddingDocument(p,profile)),byId=new Map()
    if(local) {
      for(let offset=0;offset<documents.length;offset+=24) {
        const batch=documents.slice(offset,offset+24),embedded=await embedConsumerTexts(profile,batch.map((d)=>d.text),'document')
        batch.forEach((doc,i)=>{byId.set(doc.key,embedded.vectors[i]);vectors.push({profile:profile.id,key:doc.key,hash:doc.hash,vector:embedded.vectors[i]})})
        builds.push({profile:profile.id,documents:batch.length,ms:embedded.durationMs,calls:embedded.calls})
      }
    }
    for(const test of searchBenchmarkCases)for(let language=0;language<2;language++) {
      const base={...keywordSearchSpec(test.category),query:test.queries[language],sessionTerms:test.terms[language]}
      for(const mode of local?['keyword','semantic','hybrid']:['keyword']) {
        const spec={...base,retrieval:{mode,profile:profile.id}},started=performance.now()
        const semantic=async(query,eligible,selected,signal)=>{
          const embedded=await embedConsumerTexts(selected,[query.query],'query',signal)
          const recallStarted=performance.now()
          vectors.push({profile:selected.id,query:query.query,mode,vector:embedded.vectors[0]})
          const matches=eligible.map((product)=>({id:product.id,similarity:cosine(embedded.vectors[0],byId.get(product.id))})).sort((a,b)=>b.similarity-a.similarity)
          return {matches,metrics:{embeddingCalls:embedded.calls,embeddingInputTokens:embedded.inputTokens,embeddingMs:embedded.durationMs,retrievalMs:Math.round(performance.now()-recallStarted)}}
        }
        const result=await retrieveDiscoveryCandidates(spec,undefined,undefined,{catalog:()=>catalog,semantic})
        const ranked=result.products.map((p)=>p.id),relevant=new Set(test.expected)
        const top=ranked.slice(0,3),hits=top.filter((id)=>relevant.has(id)).length
        const dcg=top.reduce((sum,id,index)=>sum+(relevant.has(id)?1/Math.log2(index+2):0),0)
        const ideal=Array.from({length:Math.min(3,relevant.size)},(_,index)=>1/Math.log2(index+2)).reduce((a,b)=>a+b,0)
        const violations=result.products.filter((p)=>!eligibleConsumerProduct(p,spec)).map((p)=>p.id)
        rows.push({split:test.split,language:language?'en':'zh',query:spec.query,spec,profile:profile.id,mode,
          hitAt3:hits>0,recallAt3:hits/relevant.size,ndcgAt3:dcg/ideal,
          expectedRanks:test.expected.map((id)=>({id,rank:ranked.indexOf(id)+1})),top5:ranked.slice(0,5),
          localRequestMs:Math.round(performance.now()-started),violations,metrics:result.report})
      }
    }
  }
  const summaries=[]
  for(const profile of profiles)for(const mode of local?['keyword','semantic','hybrid']:['keyword'])for(const split of ['development','holdout'])for(const language of ['zh','en']) {
    const group=rows.filter((r)=>r.profile===profile&&r.mode===mode&&r.split===split&&r.language===language)
    summaries.push({profile,mode,split,language,queries:group.length,hitsAt3:group.filter((r)=>r.hitAt3).length,
      recallAt3:group.reduce((s,r)=>s+r.recallAt3,0)/group.length,ndcgAt3:group.reduce((s,r)=>s+r.ndcgAt3,0)/group.length,
      localP95Ms:percentile(group.map((r)=>r.localRequestMs),0.95),embeddingCalls:group.reduce((s,r)=>s+r.metrics.embeddingCalls,0),
      fallbackCount:group.filter((r)=>r.metrics.degraded).length,hardViolationCount:group.reduce((s,r)=>s+r.violations.length,0)})
  }
  const report={catalogVersion:CONSUMER_CATALOG_VERSION,catalogSize:catalog.length,paidModelCalls:0,
    scope:'Hand-authored Search Specs; actual shared retrieval and local BGE; exact in-memory cosine replaces vector RPC. Latency excludes parser, auth, database, network, persistence and browser. Labels identify target items, not all relevant catalog items. No cloud-model comparison.',
    builds,summaries,rows}
  await mkdir(output,{recursive:true})
  await writeFile(path.join(output,'benchmark.json'),JSON.stringify(report,null,2))
  if(local)await writeFile(path.join(output,'vectors.json'),JSON.stringify(vectors))
  console.log(JSON.stringify({output,catalogSize:catalog.length,paidModelCalls:0,summaries},null,2))
  if(rows.some((r)=>r.violations.length||r.metrics.degraded))process.exitCode=1
} finally {await server.close()}
