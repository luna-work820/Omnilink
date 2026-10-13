// Probe live RLS state via pg-meta endpoints (uses service role key only).
// Outputs only counts/shapes — no secret data.

import { readFileSync } from 'node:fs'

function loadEnv(path) {
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    out[line.slice(0, eq)] = line.slice(eq + 1)
  }
  return out
}
const env = loadEnv('.env.local')
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const SRK = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPA || !SRK) {
  console.log('FATAL: missing env vars')
  process.exit(1)
}

const hdr = { apikey: SRK, Authorization: `Bearer ${SRK}` }

async function probe(p) {
  const r = await fetch(SUPA + p, { headers: hdr })
  const t = await r.text()
  console.log(`\n${p}  →  ${r.status}`)
  console.log(t.slice(0, 2500))
}

await probe('/pg-meta/policies?schema=eq.public&order=table,command,name')
await probe('/pg-meta/tables?schema=eq.public&select=id,name,rls_enabled,rls_forced&order=name')
await probe('/pg-meta/columns?select=table,name,data_type,is_nullable,is_primary_key&table=in=(stores,store_settings)&order=table,ordinal_position')
