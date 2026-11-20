import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import type { ProductItem } from '@/components/consumer-market/types'
import { readPublishedConsumerCatalog } from '@/lib/products/consumer-catalog-store'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { embedConsumerTexts, EmbeddingError } from './embedding-provider'
import { DEFAULT_EMBEDDING_PROFILE,embeddingProfiles, type EmbeddingProfile, type EmbeddingProfileId } from './embedding-profile'
import type { DiscoverySpec } from './discovery-contract'
import { eligibleConsumerProduct,materialConcepts,searchConcepts,containsSearchTerm,searchableProductFacts } from './search-spec'
import type { ExchangeRates } from './exchange-rates'

type Metrics = {embeddingCalls: number; embeddingInputTokens: number | null; embeddingMs: number; retrievalMs: number}
export class SemanticSearchError extends Error {
  constructor(readonly code: string, readonly metrics: Metrics) { super(code) }
}
export function productEmbeddingDocument(product: ProductItem, profile:EmbeddingProfile=embeddingProfiles['bge-small-zh-v1.5-512-v1']) {
  const legacy = [product.name, product.category, product.shortDescription, product.storeName,
    ...Object.entries(product.specs ?? {}).filter(([,value])=>!/^https?:\/\//i.test(String(value))).map(([key, value]) => `${key}: ${value}`)].join('\n').normalize('NFKC').trim().slice(0, 4000)
  const facts=searchableProductFacts(product)
  const aliases=[...searchConcepts,...materialConcepts].filter((group)=>group.some((term)=>containsSearchTerm(facts.toLowerCase(),term)))
    .flatMap((group)=>[...group])
  const text=profile.preprocessing==='product-facts-v1'?legacy:[facts,...new Set(aliases)].join('\n').slice(0,4000)
  return {key: product.id, text, hash: createHash('sha256').update(text).digest('hex')}
}
function sameProfile(value: Record<string, unknown> | null, expected: EmbeddingProfile) {
  return value && Object.keys(value).length===Object.keys(expected).length
    && Object.entries(expected).every(([key, item]) => value[key] === item)
}

export async function searchConsumerCatalogByVector(spec: DiscoverySpec, products: ProductItem[], profile: EmbeddingProfile, signal?: AbortSignal, rates?: ExchangeRates | null) {
  const metrics: Metrics = {embeddingCalls: 0, embeddingInputTokens: null, embeddingMs: 0, retrievalMs: 0}
  products=products.filter((product)=>eligibleConsumerProduct(product,spec,rates))
  if(!products.length)return {matches:[],metrics}
  const started = performance.now()
  const fail = (code: string): never => { throw new SemanticSearchError(code, {...metrics, retrievalMs: Math.round(performance.now() - started) - metrics.embeddingMs}) }
  try {
    const service = createServiceRoleClient(), documents = products.map((product)=>productEmbeddingDocument(product,profile))
    const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000)
    const validateIndex = async () => {
      const [profileResult,rows] = await Promise.all([
        service.from('consumer_embedding_profiles').select('profile,status').eq('id', profile.id).abortSignal(requestSignal).maybeSingle(),
        service.from('consumer_catalog_vectors').select('product_key,content_hash').eq('profile_id', profile.id)
          .in('product_key', documents.map((doc) => doc.key)).abortSignal(requestSignal),
      ])
      const {data: index, error} = profileResult
      if (error) fail('INDEX_UNAVAILABLE')
      if (!index) fail('INDEX_MISSING')
      if (!sameProfile(index!.profile, profile)) fail('INDEX_PROFILE_MISMATCH')
      if (index!.status !== 'ready') fail('INDEX_NOT_READY')
      if (rows.error) fail('INDEX_UNAVAILABLE')
      const hashes = new Map((rows.data ?? []).map((row: {product_key: string; content_hash: string}) => [row.product_key, row.content_hash]))
      if (documents.some((doc) => !hashes.has(doc.key))) fail('INDEX_INCOMPLETE')
      if (documents.some((doc) => hashes.get(doc.key) !== doc.hash)) fail('INDEX_STALE')
    }
    // The match RPC checks profile, readiness and document hashes atomically; paid embeddings still preflight first.
    if (profile.provider !== 'local-bge') await validateIndex()
    const embedStarted = performance.now()
    try {
      const result = await embedConsumerTexts(profile, [spec.query], 'query', signal)
      metrics.embeddingCalls = result.calls; metrics.embeddingInputTokens = result.inputTokens; metrics.embeddingMs = result.durationMs
      const matches = await service.rpc('match_consumer_catalog_vectors', {
        p_profile: profile, p_query: `[${result.vectors[0].join(',')}]`,
        p_documents: documents.map((doc) => ({key: doc.key, hash: doc.hash})), p_limit: Math.min(products.length, 1000),
      }).abortSignal(signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000))
      if (matches.error) {
        if (profile.provider === 'local-bge') await validateIndex()
        fail('INDEX_QUERY_FAILED')
      }
      const allowed = new Set(documents.map((doc) => doc.key))
      const values = (matches.data ?? []) as {product_key: string; similarity: number}[]
      // A concurrent index change must not be mistaken for an empty or partial search.
      if (new Set(values.map((row) => row.product_key)).size !== documents.length || values.some((row) => !allowed.has(row.product_key))) {
        if (profile.provider === 'local-bge') await validateIndex()
        fail('INDEX_CHANGED')
      }
      metrics.retrievalMs = Math.round(performance.now() - started) - metrics.embeddingMs
      return {matches: values.filter((row) => allowed.has(row.product_key) && Number.isFinite(row.similarity))
        .map((row) => ({id: row.product_key, similarity: row.similarity})), metrics}
    } catch (error) {
      if (error instanceof EmbeddingError) {
        metrics.embeddingCalls = error.calls; metrics.embeddingMs = Math.round(performance.now() - embedStarted)
        fail(error.code)
      }
      throw error
    }
  } catch (error) {
    if (signal?.aborted || error instanceof SemanticSearchError) throw error
    return fail('INDEX_UNAVAILABLE')
  }
}

/** Explicit worker entry. It is never called by a user search or a page request. */
export async function indexPendingConsumerProducts(profileId: EmbeddingProfileId = DEFAULT_EMBEDDING_PROFILE, signal?: AbortSignal) {
  const profile = embeddingProfiles[profileId], service = createServiceRoleClient(), token = randomUUID()
  const timeout=()=>signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)
  const documents = (await readPublishedConsumerCatalog()).products.map((product)=>productEmbeddingDocument(product,profile))
  const claim = await service.rpc('claim_consumer_embedding_profile', {p_profile: profile, p_token: token}).abortSignal(timeout())
  if (claim.error) throw new Error('INDEX_CLAIM_FAILED')
  if (!claim.data) return {status: 'busy' as const, indexed: 0, calls: 0, inputTokens: null}
  let indexed = 0, calls = 0, inputTokens: number | null = profile.provider === 'qwen' ? 0 : null
  try {
    const existing = await service.from('consumer_catalog_vectors').select('product_key,content_hash').eq('profile_id', profile.id).abortSignal(timeout())
    if (existing.error) throw new Error('INDEX_UNAVAILABLE')
    const hashes = new Map((existing.data ?? []).map((row: {product_key: string; content_hash: string}) => [row.product_key, row.content_hash]))
    const changed = documents.filter((doc) => hashes.get(doc.key) !== doc.hash)
    const size = profile.provider === 'qwen' ? 10 : 24
    for (let offset = 0; offset < changed.length; offset += size) {
      const batch = changed.slice(offset, offset + size), embedded = await embedConsumerTexts(profile, batch.map((doc) => doc.text), 'document', signal)
      calls += embedded.calls
      inputTokens = inputTokens === null || embedded.inputTokens === null ? null : inputTokens + embedded.inputTokens
      const saved = await service.rpc('write_consumer_catalog_vectors', {p_profile: profile, p_token: token,
        p_rows: batch.map((doc, i) => ({key: doc.key, hash: doc.hash, embedding: `[${embedded.vectors[i].join(',')}]`}))}).abortSignal(timeout())
      if (saved.error) throw new Error('INDEX_LEASE_LOST')
      indexed += batch.length
    }
    const completed = await service.rpc('finish_consumer_embedding_profile', {p_profile_id: profile.id, p_token: token,
      p_documents: documents.map((doc) => ({key: doc.key, hash: doc.hash})), p_error: null}).abortSignal(timeout())
    if (completed.error || !completed.data) throw new Error('INDEX_LEASE_LOST')
    return {status: 'ready' as const, indexed, calls, inputTokens}
  } catch (error) {
    await service.rpc('finish_consumer_embedding_profile', {p_profile_id: profile.id, p_token: token, p_documents: [], p_error: 'INDEX_BUILD_FAILED'}).abortSignal(AbortSignal.timeout(8000))
    throw error
  }
}
