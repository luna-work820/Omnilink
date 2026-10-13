/**
 * smoke.mjs —— 连通性自检。
 * 验证三件事：能连上 Supabase、能读 canonical 语义、provenance 字段完整。
 */

import { searchProducts, getProduct } from './data.mjs'

const { count, scanned, results } = await searchProducts({ limit: 5 })

console.log(`scan=${scanned} matched=${count}`)
if (count === 0) {
  console.log('没有读到商品。检查：.env.local 凭据 / catalog_items.status 是否为 active / RLS 是否放行。')
  process.exit(1)
}

for (const r of results) {
  console.log('---')
  console.log(`${r.name} | ${r.price} ${r.currency} | store=${r.store ?? '(未标注)'}`)
  console.log(`canonical_source: ${r.provenance.canonical_source}`)
  console.log(`attributes: ${JSON.stringify(r.attributes)}`)
  console.log(`attribution: ${r.provenance.attribution}`)
}

const detail = await getProduct({ productId: results[0].id })
console.log('---')
console.log('get_product 往返成功:', detail?.id === results[0].id)
console.log('license:', detail?.provenance.license)
