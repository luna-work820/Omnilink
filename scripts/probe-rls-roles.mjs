// Fetch the actual policies on stores / store_settings using SQL via
// the Supabase Management API or pg-meta (RPC). pg-meta isn't directly
// available without a project-level rpc. Try SQL via the REST endpoint:
// POST /rest/v1/rpc/<function>. Without our own function, we use a
// raw pg query via the Supabase storage-like endpoint? No.
// Instead: use a direct SQL execution via the Supabase hostname is also
// not available to anon. So: use the `https://api.supabase.com` mgmt API
// is also restricted.
//
// Practical approach: try a set of probe inserts under different roles
// to characterize which role(s) can write.

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

async function insert(label, headers) {
  const ins = await fetch(`${URL}/rest/v1/stores`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_id: 'a5f3cb9c-07d1-4958-92b7-9c488964fa3b',
      store_name: 'rls-probe-' + label + '-' + Date.now(),
      store_slug: 'rls-probe-' + label + '-' + Date.now(),
    }),
  })
  const txt = await ins.text()
  console.log(`[${label}] POST → ${ins.status}: ${txt.slice(0, 200)}`)
}

// Variant A: apikey=secret_..., no JWT (this is "service_role" path)
await insert('secret_no_jwt', { apikey: KEY, Authorization: `Bearer ${KEY}` })

// Variant B: apikey=secret_..., JWT=login (mimic server action path)
const sessionResp = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: KEY },
  body: JSON.stringify({ email: 'diag-test-1786519709082@omnilink.test', password: 'wont-work-here' }),
})
console.log('[jwt_login] HTTP', sessionResp.status)
console.log('  body:', (await sessionResp.text()).slice(0, 200))
