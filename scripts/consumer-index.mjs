import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { configureSystemProxy } from './system-proxy.mjs'

configureSystemProxy()
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const args=process.argv.slice(2)
const profile=args.includes('--profile')?args[args.indexOf('--profile')+1]:'bge-small-zh-v1.5-512-v1'
const build=args.includes('--build')
const evaluate=args.includes('--evaluate')
const mode=args.includes('--mode')?args[args.indexOf('--mode')+1]:'keyword'
if((build||evaluate&&mode!=='keyword')&&!args.includes('--allow-model-calls'))throw new Error('此操作可能调用 Embedding 模型。请显式添加 --allow-model-calls；不带 --build 或 --evaluate 只输出计划。')

// Run the existing server modules with the project's installed TypeScript loader.
const server=await createServer({root,configFile:false,envDir:false,appType:'custom',
  resolve:{alias:{'@':root}},server:{middlewareMode:true,watch:{ignored:['**/*']}},
  plugins:[{name:'consumer-index-server-only',resolveId(id){if(id==='server-only')return '\0consumer-index-server-only'},
    load(id){if(id==='\0consumer-index-server-only')return 'export {}'}}],
})
try {
  const {embeddingProfiles}=await server.ssrLoadModule('/lib/consumer-advisor/embedding-profile.ts')
  if(!Object.hasOwn(embeddingProfiles,profile))throw new Error('未知的 Embedding Profile。')
  const {readPublishedConsumerCatalog}=await server.ssrLoadModule('/lib/products/consumer-catalog-store.ts')
  if(build) {
    const {indexPendingConsumerProducts}=await server.ssrLoadModule('/lib/consumer-advisor/consumer-catalog-vector.ts')
    console.log(JSON.stringify(await indexPendingConsumerProducts(profile)))
  } else if(evaluate) {
    const {keywordSearchSpec}=await server.ssrLoadModule('/lib/consumer-advisor/search-spec.ts')
    const {retrieveDiscoveryCandidates}=await server.ssrLoadModule('/lib/consumer-advisor/discovery-retrieval.ts')
    const pairs=[]
    for(const queries of [['耳环','earrings'],['项链','necklace'],['戒指','rings']]) {
      const results=[]
      for(const query of queries) {
        const result=await retrieveDiscoveryCandidates({...keywordSearchSpec(query),retrieval:{mode,profile}})
        results.push({query,ids:result.products.map((product)=>product.id),top:result.products.slice(0,3).map((product)=>product.name),metrics:result.report})
      }
      pairs.push({queries,sameOrder:JSON.stringify(results[0].ids)===JSON.stringify(results[1].ids),results})
    }
    console.log(JSON.stringify({action:'evaluate',mode,profile,pairs},null,2))
  } else {
    console.log(JSON.stringify({action:'plan',profile:embeddingProfiles[profile],documents:(await readPublishedConsumerCatalog()).products.length,modelCalls:0},null,2))
  }
}finally{await server.close()}
