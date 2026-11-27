import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { configureSystemProxy } from './system-proxy.mjs'

configureSystemProxy()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#') || !line.includes('=')) continue
  const [key, ...rest] = line.split('=')
  if (!process.env[key.trim()]) process.env[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '')
}
const server = await createServer({ root, configFile: false, envDir: false, appType: 'custom',
  resolve: { alias: { '@': root } }, server: { middlewareMode: true, watch: { ignored: ['**/*'] } },
  plugins: [{ name: 'stale-vector-server-only', resolveId(id) {
    if (id === 'server-only') return '\0stale-vector-server-only'
  }, load(id) { if (id === '\0stale-vector-server-only') return 'export {}' } }] })
try {
  const { readPublishedConsumerCatalog } = await server.ssrLoadModule('/lib/products/consumer-catalog-store.ts')
  const { embeddingProfiles, DEFAULT_EMBEDDING_PROFILE } = await server.ssrLoadModule('/lib/consumer-advisor/embedding-profile.ts')
  const { productEmbeddingDocument } = await server.ssrLoadModule('/lib/consumer-advisor/consumer-catalog-vector.ts')
  const { createServiceRoleClient } = await server.ssrLoadModule('/lib/supabase/service-role.ts')
  const profile = embeddingProfiles[DEFAULT_EMBEDDING_PROFILE]
  const products = (await readPublishedConsumerCatalog()).products
  const documents = products.map((product) => productEmbeddingDocument(product, profile))
  const service = createServiceRoleClient()
  const { data, error } = await service.from('consumer_catalog_vectors')
    .select('product_key,content_hash').eq('profile_id', profile.id)
  if (error) throw error
  const hashes = new Map((data ?? []).map((row) => [row.product_key, row.content_hash]))
  const stale = documents.filter((doc) => hashes.has(doc.key) && hashes.get(doc.key) !== doc.hash)
  console.log(JSON.stringify({ profile: profile.id, indexed: hashes.size,
    candidates: documents.length, stale: stale.length,
    staleKeys: stale.slice(0, 20).map((doc) => doc.key) }, null, 2))
} finally { await server.close() }
