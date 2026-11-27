import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import { configureSystemProxy } from './system-proxy.mjs'

configureSystemProxy()
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({ root, configFile: false, envDir: false, appType: 'custom',
  resolve: { alias: { '@': root } }, server: { middlewareMode: true, watch: { ignored: ['**/*'] } },
  plugins: [{ name: 'composition-extract-server-only', resolveId(id) {
    if (id === 'server-only') return '\0composition-extract-server-only'
  }, load(id) { if (id === '\0composition-extract-server-only') return 'export {}' } }] })
try {
  const { extractCompositionFromHtml } = await server.ssrLoadModule('/lib/products/product-composition-extract.ts')
  const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'))
  const results = []
  for (const entry of manifest) {
    if (entry.code !== '200' || /品牌参考/.test(entry.category || '')) continue
    const html = await readFile(entry.path, 'utf8')
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').toLowerCase()
    const nameMatch = (entry.name || '').slice(0, 24).toLowerCase().split(' ')[0]
      .split('').every((char) => char === ' ' || text.includes(char))
    const composition = extractCompositionFromHtml(html, entry.url, '2026-11-26', entry.category || '')
    results.push({ id: entry.id, name: entry.name, url: entry.url, host: entry.host,
      nameMatch, composition })
  }
  console.log(JSON.stringify(results, null, 2))
} finally { await server.close() }
