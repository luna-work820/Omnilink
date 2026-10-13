// Diagnose (round 2): inspect existing rows + RLS state on stores.
// Uses the same .env.local key (which is sb_secret_..., service-role-equivalent).

import { createClient } from '@supabase/supabase-js'
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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log('[DIAG] Inspecting existing stores rows (limit 10)...')
const { data: rows, error: rowsErr } = await supabase.from('stores').select('*').limit(10)
if (rowsErr) {
  console.log('  ERROR:', rowsErr.code, rowsErr.message)
} else {
  console.log('  count:', rows.length)
  for (const r of rows) {
    console.log('  -', JSON.stringify({
      id: r.id,
      owner_id: r.owner_id,
      store_name: r.store_name,
      industry_id: r.industry_id,
      industry_category: r.industry_category,
      created_at: r.created_at,
    }))
  }
  if (rows.length > 0) {
    console.log('\n  DISTINCT industry_id values    :', [...new Set(rows.map(r => r.industry_id))])
    console.log('  DISTINCT industry_category vals:', [...new Set(rows.map(r => r.industry_category))])
    console.log('  Any rows with industry_category non-NULL?', rows.some(r => r.industry_category != null))
  }
}

console.log('\n[DIAG] Query pg_policies for stores (RLS check via PostgREST introspection)...')
// PostgREST exposes pg_policies via select on tables in information_schema — but normally
// anon role cannot read pg_catalog. Try a known RPC — if none exists we'll fail.
// We just probe via rpc 'version' to confirm we can hit DB at all, then try policies.
const { error: rpcErr } = await supabase.rpc('version')
console.log('  rpc("version"):', rpcErr ? `${rpcErr.code} ${rpcErr.message}` : 'OK (DB reachable)')

// Read pg_policies via service-role-level path is impossible without that explicit key.
// The strongest signal we can get without console access is:
//   Try a SELECT through the anon-role key. If RLS is on with no policy => 0 rows.
//   In step above we returned N rows => RLS is OFF (or a permissive SELECT policy exists).

console.log('\n[DIAG] Optional: insert one row with a *real* auth.users id? Cannot without service_role.')
console.log('[DIAG] Probing auth.users table readability (often RLS-locked)...')
const { data: usersData, error: usersErr } = await supabase.from('users' /* not the real table */).select('id').limit(1)
if (usersErr) {
  console.log('  (expected) reading "users" failed:', usersErr.code, usersErr.message)
  console.log('  (Postgres uses auth.users, accessed only via service_role)')
}

console.log('\n[DIAG] DONE.')
