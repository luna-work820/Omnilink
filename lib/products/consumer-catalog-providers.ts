import 'server-only'
import { canonicalProductUrl } from './consumer-catalog-ingest'

export type CatalogProvider = 'firecrawl' | 'apify'

export async function fetchProductHtml(provider: CatalogProvider, rawUrl: string, signal?: AbortSignal): Promise<string> {
  const url = canonicalProductUrl(rawUrl)
  const token = provider === 'firecrawl' ? process.env.FIRECRAWL_API_KEY : process.env.APIFY_TOKEN
  if (!token) throw new Error('CATALOG_PROVIDER_NOT_CONFIGURED')
  const endpoint = provider === 'firecrawl' ? 'https://api.firecrawl.dev/v2/scrape'
    : 'https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?timeout=60&memory=512&maxTotalChargeUsd=0.05&format=json&clean=true'
  const body = provider === 'firecrawl' ? {url, formats:['rawHtml']} : {
    startUrls:[{url}],crawlerType:'cheerio',maxCrawlDepth:0,maxCrawlPages:1,useSitemaps:false,
    respectRobotsTxtFile:true,proxyConfiguration:{useApifyProxy:true},htmlTransformer:'none',
    removeElementsCssSelector:'dummy_keep_everything',saveHtml:true,saveMarkdown:false,saveFiles:false,summarize:false,
  }
  const response = await fetch(endpoint, {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(80_000)]):AbortSignal.timeout(80_000)})
  if (!response.ok) throw new Error(`CATALOG_PROVIDER_HTTP_${response.status}`)
  const value = await response.json()
  const html: unknown = provider === 'firecrawl' ? value?.data?.rawHtml : Array.isArray(value) ? value[0]?.html : null
  if (typeof html !== 'string' || !html) throw new Error('CATALOG_PROVIDER_EMPTY')
  if (Buffer.byteLength(html) > 8_000_000) throw new Error('PRODUCT_HTML_TOO_LARGE')
  return html
}
