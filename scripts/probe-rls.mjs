// Probe the live RLS state on stores + store_settings to confirm
// whether the e2e test failure is environmental (RLS on/off) or
// related to the P0 fix.

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

// 1) Inspect pg_policies via PostgREST RPC isn't possible without an RPC,
//    so we use the standard SQL endpoint? Actually we can hit /rest/v1/...
//    directly. We'll fetch the existing policies via information_schema.
const hdr = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

async function sql(q) {
  // pg-meta style: select via headless public.'tables' is not available
  // without an RPC. We'll skip and just call the diagnostic insert to
  // characterize the error structurally.
  return null
}

console.log('== RLS STATE PROBE ==')
console.log('URL =', URL)
console.log('KEY prefix =', KEY.slice(0, 16))

// Try to fetch existing rows to see if anonymous read works at all.
// If RLS is on with no SELECT policy, this returns 401/403 or [].
const sel = await fetch(
  `${URL}/rest/v1/stores?select=id,store_name&limit=3`,
  { headers: hdr }
)
console.log('GET /rest/v1/stores →', sel.status)
const body = await sel.text()
console.log('  body:', body.slice(0, 300))

// Now try an INSERT as anon (no JWT) to see what role Postgres sees.
const ins = await fetch(
  `${URL}/rest/v1/stores`,
  {
    method: 'POST',
    headers: { ...hdr, Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_id: 'a5f3cb9c-07d1-4958-92b7-9c488964fa3b',  // our test user
      store_name: 'probe-rls-' + Date.now(),
      store_slug: 'probe-rls-' + Date.now(),
    }),
  }
)
console.log('POST /rest/v1/stores (anon key, no JWT) →', ins.status)
console.log('  body:', (await ins.text()).slice(0, 300))
