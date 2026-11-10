import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { embedLocalBge, localBgePgVector, LOCAL_BGE_MODEL } from './local-bge'

type DiscoveryRow = {
  id: string
  title: string
  item_type: string | null
  description: string | null
  category: string | null
  publisher_name: string
}

const INDEX_BATCH_SIZE = 24

function productEmbeddingText(product: DiscoveryRow) {
  return `商品名称：${product.title}。商品类型：${product.item_type ?? ''}。一级类目：${product.category ?? ''}。商品描述：${product.description ?? ''}。店铺：${product.publisher_name}`.slice(0, 4000)
}

function contentHash(text: string) {
  return createHash('sha256').update(text).digest('hex')
}

async function indexPendingConsumerProducts() {
  const service = createServiceRoleClient() as unknown as SupabaseClient
  const { data: jobs, error: claimError } = await service.rpc('claim_consumer_catalog_embedding_jobs', {
    p_limit: INDEX_BATCH_SIZE,
  })
  if (claimError) throw new Error(claimError.message)
  const productIds = (jobs ?? []).map((job: { product_id: string }) => job.product_id)
  if (!productIds.length) return

  try {
    const { data: products, error: productError } = await service.from('discovery_products')
      .select('id, title, item_type, description, category, publisher_name')
      .in('id', productIds)
    if (productError) throw new Error(productError.message)

    const visible = (products ?? []) as DiscoveryRow[]
    const visibleIds = visible.map((product) => product.id)
    const { data: existing, error: existingError } = await service.from('consumer_catalog_embeddings')
      .select('product_id, content_hash, model').in('product_id', visibleIds.length ? visibleIds : ['00000000-0000-0000-0000-000000000000'])
    if (existingError) throw new Error(existingError.message)

    const hashes = new Map((existing ?? []).map((row: { product_id: string; content_hash: string; model: string }) => [row.product_id, row]))
    const changed = visible.flatMap((product) => {
      const text = productEmbeddingText(product)
      const hash = contentHash(text)
      const old = hashes.get(product.id)
      return old?.content_hash === hash && old.model === LOCAL_BGE_MODEL ? [] : [{ product, text, hash }]
    })

    if (changed.length) {
      const vectors = await embedLocalBge(changed.map((item) => item.text), 'document')
      const { error: upsertError } = await service.from('consumer_catalog_embeddings').upsert(changed.map((item, index) => ({
        product_id: item.product.id,
        embedding: localBgePgVector(vectors[index]),
        model: LOCAL_BGE_MODEL,
        content_hash: item.hash,
        indexed_at: new Date().toISOString(),
      })), { onConflict: 'product_id' })
      if (upsertError) throw new Error(upsertError.message)
    }

    const hiddenIds = productIds.filter((id: string) => !visibleIds.includes(id))
    if (hiddenIds.length) {
      const { error: deleteError } = await service.from('consumer_catalog_embeddings').delete().in('product_id', hiddenIds)
      if (deleteError) throw new Error(deleteError.message)
    }

    const { error: doneError } = await service.from('consumer_catalog_embedding_jobs').delete().in('product_id', productIds)
    if (doneError) throw new Error(doneError.message)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await service.from('consumer_catalog_embedding_jobs')
      .update({ locked_until: null, last_error: message.slice(0, 500) }).in('product_id', productIds)
    throw error
  }
}

export async function searchConsumerCatalogByVector(query: string, limit = 24, maxPrice: number | null = null) {
  try {
    await indexPendingConsumerProducts()
  } catch (error) {
    console.warn('[consumer catalog vector] index batch unavailable; continuing with existing vectors', error)
  }
  const [queryVector] = await embedLocalBge([query], 'query')
  const service = createServiceRoleClient() as unknown as SupabaseClient
  const { data, error } = await service.rpc('match_consumer_catalog_embeddings', {
    p_query_embedding: localBgePgVector(queryVector),
    p_model: LOCAL_BGE_MODEL,
    p_match_count: Math.min(Math.max(limit, 1), 50),
    p_max_price: maxPrice,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).flatMap((row: { product_id: string; similarity: number }) =>
    typeof row.product_id === 'string' ? [{ id: row.product_id, similarity: Number(row.similarity) }] : [])
}
