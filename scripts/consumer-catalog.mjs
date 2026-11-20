import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { configureSystemProxy } from './system-proxy.mjs'

configureSystemProxy()
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const args=process.argv.slice(2)
const option=(name)=>{const index=args.indexOf(name);return index<0?undefined:args[index+1]}
const provider=option('--provider'), url=option('--url')
const seed=args.includes('--seed'), publish=args.includes('--publish')
if (!seed && (!['firecrawl','apify'].includes(provider) || !url)) {
  throw new Error('用法：--seed，或 --provider firecrawl|apify --url <商品网址> [--publish] [--no-index]')
}

const server=await createServer({root,configFile:false,envDir:false,appType:'custom',resolve:{alias:{'@':root}},
  server:{middlewareMode:true,watch:{ignored:['**/*']}},
  plugins:[{name:'consumer-catalog-server-only',resolveId(id){if(id==='server-only')return '\0consumer-catalog-server-only'},
    load(id){if(id==='\0consumer-catalog-server-only')return 'export {}'}}]})
try {
  const {saveConsumerCatalogProduct,readPublishedConsumerCatalog}=await server.ssrLoadModule('/lib/products/consumer-catalog-store.ts')
  if(seed) {
    const {readConsumerCatalog}=await server.ssrLoadModule('/lib/products/consumer-catalog.ts')
    const products=readConsumerCatalog()
    let saved=0
    for(const product of products) {
      const date=product.sourceDate && !Number.isNaN(Date.parse(product.sourceDate)) ? new Date(product.sourceDate).toISOString() : new Date().toISOString()
      await saveConsumerCatalogProduct({...product,sourceDate:date},'sample',true)
      saved++
    }
    console.log(JSON.stringify({action:'seed',saved}))
  } else {
    const {fetchProductHtml}=await server.ssrLoadModule('/lib/products/consumer-catalog-providers.ts')
    const {normalizeScrapedProduct}=await server.ssrLoadModule('/lib/products/consumer-catalog-ingest.ts')
    const product=normalizeScrapedProduct(await fetchProductHtml(provider,url),url)
    const id=await saveConsumerCatalogProduct(product,provider,publish)
    console.log(JSON.stringify({action:'import',provider,id,name:product.name,publishRequested:publish,hasImage:Boolean(product.mainImage)}))
  }
  if((seed || publish || args.includes('--index')) && !args.includes('--no-index')) {
    const {indexPendingConsumerProducts}=await server.ssrLoadModule('/lib/consumer-advisor/consumer-catalog-vector.ts')
    const result=await indexPendingConsumerProducts()
    console.log(JSON.stringify({action:'index',...result}))
    if(result.status==='busy')process.exitCode=1
  }
  console.log(JSON.stringify({action:'catalog',published:(await readPublishedConsumerCatalog()).products.length}))
} finally { await server.close() }
