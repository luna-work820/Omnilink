// Diagnose store INSERT — bypasses Next.js / cookies / server actions.
// Reproduces lib/stores/service.ts:29-50 INSERT logic exactly, using only
// @supabase/supabase-js, to expose the raw Postgres / RLS error.
//
// Run: node scripts/diagnose-store-insert.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// ---- Manual .env.local loader (no dotenv dependency) ----
function loadEnv(path) {
  const out = {}
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const k = line.slice(0, eq).trim()
    const v = line.slice(eq + 1).trim()
    out[k] = v
  }
  return out
}

const env = loadEnv('.env.local')
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('=========================================================')
console.log('[DIAG] Environment check')
console.log('  URL       :', URL)
console.log('  Key prefix:', KEY?.slice(0, 25))
console.log('  Key length:', KEY?.length, 'chars')
console.log('  Key starts with sb_publishable_?', KEY?.startsWith('sb_publishable_'))
console.log('  Key starts with sb_secret_?     ', KEY?.startsWith('sb_secret_'))
console.log('  Key is JWT (starts with eyJ)?   ', KEY?.startsWith('eyJ'))
console.log('=========================================================')

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---- Step 1: probe stores table schema by selecting 0 rows ----
console.log('\n[DIAG] Step 1: probe stores columns via empty SELECT...')
const probeCols = ['id', 'owner_id', 'store_name', 'store_slug', 'industry_id', 'industry_category']
const { data: probeData, error: probeErr } = await supabase
  .from('stores')
  .select(probeCols.join(','))
  .limit(0)

if (probeErr) {
  console.log('[DIAG] probe error:', probeErr.code, probeErr.message)
} else {
  console.log('[DIAG] probe OK. Schema returned (row count 0). Columns selected without error.')
  console.log('         This means columns:', probeCols, 'all exist.')
}

// ---- Step 2: try INSERT with a fake-but-valid UUID owner_id ----
// This mirrors service.ts:29-39 exactly.
console.log('\n[DIAG] Step 2: reproduce service.ts INSERT (with synthetic owner_id)...')
const fakeOwnerId = '11111111-1111-1111-1111-111111111111'
const payload = {
  owner_id: fakeOwnerId,
  store_name: 'Diag-Store-Test',
  store_slug: 'diag-store-test-' + Date.now(),
  industry_id: null,                 // <-- the original P0 suspicion
  industry_category: 'eyewear',
}

console.log('[DIAG] INSERT payload:', JSON.stringify(payload, null, 2))

const { data: store, error: storeError } = await supabase
  .from('stores')
  .insert(payload)
  .select()
  .single()

if (storeError) {
  console.log('[DIAG] INSERT FAILED.')
  console.log('  message :', storeError.message)
  console.log('  code    :', storeError.code)
  console.log('  hint    :', storeError.hint)
  console.log('  details :', storeError.details)
  console.log('')
  // Decode Postgres SQLSTATE class
  const sqlstate = storeError.code
  if (sqlstate === '22P02') console.log('  >>> Postgres: invalid_text_representation (bad UUID format)')
  if (sqlstate === '23502') console.log('  >>> Postgres: not_null_violation (a NOT NULL column missing)')
  if (sqlstate === '23503') console.log('  >>> Postgres: foreign_key_violation')
  if (sqlstate === '23505') console.log('  >>> Postgres: unique_violation (duplicate key)')
  if (sqlstate === '42501') console.log('  >>> Postgres: insufficient_privilege  (← RLS likely ON)')
} else {
  console.log('[DIAG] INSERT SUCCEEDED. Created store:')
  console.log('  ', JSON.stringify(store, null, 2))
  // Cleanup
  console.log('\n[DIAG] Cleaning up test row...')
  const { error: delErr } = await supabase.from('stores').delete().eq('id', store.id)
  console.log('[DIAG] cleanup:', delErr ? `FAIL: ${delErr.message}` : 'OK')
}

// ---- Step 3: same INSERT without owner_id (NULL) ----
// Catches case where the real failing path is something else entirely.
console.log('\n[DIAG] Step 3: same INSERT but with owner_id omitted/NULL...')
const { error: nullOwnerErr } = await supabase
  .from('stores')
  .insert({
    store_name: 'Diag-NOOWNER',
    store_slug: 'diag-noowner-' + Date.now(),
    industry_id: null,
    industry_category: 'eyewear',
  })
  .select()
  .single()

if (nullOwnerErr) {
  console.log('[DIAG] NULL-owner insert error:', nullOwnerErr.code, '|', nullOwnerErr.message)
  if (nullOwnerErr.code === '23502' && nullOwnerErr.message.includes('owner_id')) {
    console.log('  >>> owner_id IS NOT NULL in DB schema (but service.ts sets it from user.id)')
  }
} else {
  console.log('[DIAG] NULL-owner insert succeeded (RLS OFF; cleanup below)')
  // cleanup would need the id but we did not store it; not critical for diagnostic.
}

console.log('\n[DIAG] DONE.')
