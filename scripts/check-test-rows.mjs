// Probe DB for any rows named "Omnilink P0 Empty Industry" or
// "Omnilink P0 Eyewear" — the user's required Test A/B stores.

import { readFileSync } from 'node:fs'

function loadEnv(path) {
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}
const env = loadEnv('.env.local')
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const hdr = { apikey: KEY, Authorization: `Bearer ${KEY}` }

const sel = await fetch(
  `${URL}/rest/v1/stores?select=id,store_name,store_slug,owner_id,industry_category,created_at&or=(store_name.eq.Omnilink%20P0%20Empty%20Industry,store_name.eq.Omnilink%20P0%20Eyewear)&order=created_at.desc`,
  { headers: hdr }
)
console.log('GET →', sel.status)
const rows = await sel.json()
console.log('rows:', JSON.stringify(rows, null, 2))

console.log('\n=== ALL stores (last 20) for context ===')
const all = await fetch(
  `${URL}/rest/v1/stores?select=id,store_name,owner_id,created_at&order=created_at.desc&limit=20`,
  { headers: hdr }
)
const allRows = await all.json()
console.log('total recent:', allRows.length)
for (const r of allRows) {
  console.log(`  ${r.id}  ${r.created_at}  owner=${r.owner_id?.slice(0,8)}…  name="${r.store_name}"`)
}
