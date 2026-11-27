import 'server-only'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { CatalogProductItem, ProductItem } from '@/components/consumer-market/types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { readConsumerCatalog } from './consumer-catalog'
import { normalizeCatalogStoreName } from './store-name'
import { withProductComposition } from './product-composition'

export type ConsumerCatalogSnapshot = { products: CatalogProductItem[]; version: string }
const PUBLISHED_CATALOG_CACHE_MS=30_000
let publishedCatalogCache:{snapshot:ConsumerCatalogSnapshot;expiresAt:number}|null=null
let publishedCatalogPending:{revision:number;promise:Promise<ConsumerCatalogSnapshot>}|null=null
let publishedCatalogRevision=0

export function catalogSnapshot(products: ProductItem[]): ConsumerCatalogSnapshot {
  const ordered = products.map(withProductComposition).sort((a, b) => a.id.localeCompare(b.id))
  const version = createHash('sha256').update(JSON.stringify(ordered)).digest('hex')
  return { products: ordered, version }
}

async function fetchPublishedConsumerCatalog(url:string,anonKey:string):Promise<ConsumerCatalogSnapshot> {
  const client = createClient(url, anonKey,
    { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error, count } = await client.from('consumer_catalog_products')
    .select('id,product,added_at', {count: 'exact'}).eq('published', true)
    .order('added_at', {ascending: false}).order('id').limit(1000).abortSignal(AbortSignal.timeout(8000))

  let catalogRows: { id: string; product: ProductItem; added_at?: string | null }[]
  let catalogCount = count
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const legacy = await client.from('consumer_catalog_products')
      .select('id,product', {count: 'exact'}).eq('published', true).order('id').limit(1000)
      .abortSignal(AbortSignal.timeout(8000))
    if (legacy.error) throw new Error('CONSUMER_CATALOG_UNAVAILABLE')
    catalogRows = (legacy.data ?? []).map((row) => ({ ...row, added_at: null }))
    catalogCount = legacy.count
  } else {
    if (error) throw new Error('CONSUMER_CATALOG_UNAVAILABLE')
    catalogRows = data ?? []
  }

  if (catalogCount !== null && catalogCount > 1000) throw new Error('CONSUMER_CATALOG_LIMIT_EXCEEDED')
  const reviewedImages = new Map(readConsumerCatalog().map((product) => [product.id, product.mainImage]))
  const products = catalogRows.map((row) => normalizeCatalogStoreName({
    ...row.product,
    id: row.id,
    mainImage: row.product.mainImage || reviewedImages.get(row.id) || '',
    catalogAddedAt: row.added_at ?? row.product.catalogAddedAt ?? null,
  }))
  return catalogSnapshot(products)
}

export function invalidatePublishedConsumerCatalog() {
  publishedCatalogRevision++
  publishedCatalogCache=null
}

export async function readPublishedConsumerCatalog(): Promise<ConsumerCatalogSnapshot> {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (process.env.CONSUMER_CATALOG_SOURCE === 'fixture' || !url || !anonKey) {
    return catalogSnapshot(readConsumerCatalog().map(normalizeCatalogStoreName))
  }
  const now=Date.now()
  if(publishedCatalogCache&&publishedCatalogCache.expiresAt>now)return publishedCatalogCache.snapshot
  if(publishedCatalogPending?.revision===publishedCatalogRevision)return publishedCatalogPending.promise

  const revision=publishedCatalogRevision
  const pending=fetchPublishedConsumerCatalog(url,anonKey)
  publishedCatalogPending={revision,promise:pending}
  try {
    const snapshot=await pending
    if(revision===publishedCatalogRevision)publishedCatalogCache={snapshot,expiresAt:Date.now()+PUBLISHED_CATALOG_CACHE_MS}
    return snapshot
  } finally {
    if(publishedCatalogPending?.promise===pending)publishedCatalogPending=null
  }
}

/** Trusted server-side read for private products that are eligible for personalization. */
export async function readRecommendableConsumerCatalog(): Promise<CatalogProductItem[]> {
  const { data, error } = await createServiceRoleClient().from('consumer_catalog_products')
    .select('id,product,composition')
    .eq('recommendable', true)
    .order('id')
    .limit(1000)
    .abortSignal(AbortSignal.timeout(8000))
  if (error) throw new Error('CONSUMER_RECOMMENDATION_CATALOG_UNAVAILABLE')

  return (data ?? []).map((row: { id: string; product: ProductItem; composition: ProductItem['composition'] }) =>
    withProductComposition(normalizeCatalogStoreName({...row.product, id: row.id, composition: row.composition})))
}

export function selectCatalogProducts<T extends ProductItem>(products: T[], ids: readonly string[]): T[] {
  const byId = new Map(products.map((product) => [product.id, product]))
  return [...new Set(ids)].flatMap((id) => byId.has(id) ? [byId.get(id)!] : [])
}

export async function saveConsumerCatalogProduct(product: ProductItem, source: 'sample' | 'firecrawl' | 'apify', publish: boolean, recommendable = false) {
  if (!product.sourceUrl || !product.sourceDate) throw new Error('PRODUCT_SOURCE_MISSING')
  const productWithComposition = withProductComposition(product)
  const result = await createServiceRoleClient().rpc('upsert_consumer_catalog_product', {
    p_url:product.sourceUrl,p_product:productWithComposition,p_source_type:source,p_captured_at:product.sourceDate,p_publish:publish,p_recommendable:recommendable,
  }).abortSignal(AbortSignal.timeout(8000))
  if (result.error || typeof result.data !== 'string') throw new Error('CONSUMER_CATALOG_WRITE_FAILED')
  invalidatePublishedConsumerCatalog()
  return result.data
}
