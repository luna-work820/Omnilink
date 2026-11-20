import 'server-only'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { ProductItem } from '@/components/consumer-market/types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { readConsumerCatalog } from './consumer-catalog'

export type ConsumerCatalogSnapshot = { products: ProductItem[]; version: string }

export function catalogSnapshot(products: ProductItem[]): ConsumerCatalogSnapshot {
  const ordered = [...products].sort((a, b) => a.id.localeCompare(b.id))
  const version = createHash('sha256').update(JSON.stringify(ordered)).digest('hex')
  return { products: ordered, version }
}

export async function readPublishedConsumerCatalog(): Promise<ConsumerCatalogSnapshot> {
  if (process.env.CONSUMER_CATALOG_SOURCE === 'fixture' ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return catalogSnapshot(readConsumerCatalog())
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error, count } = await client.from('consumer_catalog_products')
    .select('id,product', {count: 'exact'}).eq('published', true).order('id').limit(1000).abortSignal(AbortSignal.timeout(8000))
  if (error) throw new Error('CONSUMER_CATALOG_UNAVAILABLE')
  if (count !== null && count > 1000) throw new Error('CONSUMER_CATALOG_LIMIT_EXCEEDED')
  const products = (data ?? []).map((row: { id: string; product: ProductItem }) => ({...row.product, id: row.id}))
  return catalogSnapshot(products)
}

export function selectCatalogProducts(products: ProductItem[], ids: readonly string[]): ProductItem[] {
  const byId = new Map(products.map((product) => [product.id, product]))
  return [...new Set(ids)].flatMap((id) => byId.has(id) ? [byId.get(id)!] : [])
}

export async function saveConsumerCatalogProduct(product: ProductItem, source: 'sample' | 'firecrawl' | 'apify', publish: boolean) {
  if (!product.sourceUrl || !product.sourceDate) throw new Error('PRODUCT_SOURCE_MISSING')
  const result = await createServiceRoleClient().rpc('upsert_consumer_catalog_product', {
    p_url:product.sourceUrl,p_product:product,p_source_type:source,p_captured_at:product.sourceDate,p_publish:publish,
  }).abortSignal(AbortSignal.timeout(8000))
  if (result.error || typeof result.data !== 'string') throw new Error('CONSUMER_CATALOG_WRITE_FAILED')
  return result.data
}
