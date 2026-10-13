// Smoke-test INSERT with REAL user_id (created earlier via admin API).
// This reveals RLS state and any schema-level rejects, with same payload as service.ts.
// Uses the same sb_secret_ key which has been shown to have admin scope
// (it bypasses RLS iff RLS is enforced; FK constraint is DB-level so still applies).

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
const cred = JSON.parse(readFileSync('.diag-test-user.json', 'utf8'))

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log('[SMOKE] Inserting stores row with REAL owner_id =', cred.user_id)
const ts = Date.now()
const storeSlug = `diag-real-${ts}`

const payload = {
  owner_id: cred.user_id,
  store_name: 'Diag Real Store',
  store_slug: storeSlug,
  industry_id: null,
  industry_category: 'eyewear',
}

const { data, error } = await supabase.from('stores').insert(payload).select().single()

if (error) {
  console.log('[SMOKE] FAIL')
  console.log('  code    :', error.code)
  console.log('  message :', error.message)
  console.log('  hint    :', error.hint)
  console.log('  details :', error.details)
  if (error.code === '42501') console.log('  >>> RLS is ON and no INSERT policy. **P0 found.**')
  if (error.code === '23503') console.log('  >>> FK fails — owner_id not in auth.users')
  if (error.code === '22P02') console.log('  >>> bad UUID format on some column')
  if (error.code === '23502') console.log('  >>> NOT NULL violation')
  process.exit(1)
}

console.log('[SMOKE] OK — store created, id =', data.id)

// Cleanup
const { error: delErr } = await supabase.from('stores').delete().eq('id', data.id)
console.log('[SMOKE] cleanup:', delErr ? 'FAIL ' + delErr.message : 'OK')
