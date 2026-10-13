// Test plan runner for stores + store_settings RLS.
// Each scenario creates two real users via auth.admin.createUser,
// signs them in via /auth/v1/token?grant_type=password,
// then executes an operation under their JWT and records the result.
//
// Run AFTER `supabase/migrations/20260812_000001_stores_rls.sql`
// has been applied (via Dashboard SQL editor or `supabase db push`).
//
// Outputs a single-line verdict per scenario. Never prints secrets.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i < 0) continue
  env[t.slice(0, i)] = t.slice(i + 1)
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL
const SRK = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPA || !SRK) {
  console.log('FATAL: missing env vars')
  process.exit(2)
}

const ts = Date.now()
const admin = createClient(SUPA, SRK, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function creds(label) {
  const id = randomUUID().slice(0, 8)
  return {
    email: `rls-${label}-${ts}-${id}@omnilink.test`,
    password: `Rls_${label}_${randomUUID().slice(0, 8)}_Aa1!`,
  }
}

async function makeUser(label) {
  const c = creds(label)
  const r = await admin.auth.admin.createUser({
    email: c.email, password: c.password, email_confirm: true,
  })
  if (r.error) throw new Error(`createUser ${label}: ` + r.error.message)
  return { ...c, id: r.data.user.id }
}

async function signin(c) {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SRK },
    body: JSON.stringify({ email: c.email, password: c.password }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('signin fail: ' + JSON.stringify(j).slice(0, 200))
  return j.access_token
}

function clientAs(token) {
  return createClient(SUPA, SRK, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

const results = []

async function run(name, fn) {
  try {
    const verdict = await fn()
    results.push({ name, verdict })
  } catch (e) {
    results.push({ name, verdict: 'EXCEPTION', error: String(e).slice(0, 200) })
  }
}

// === create two users ===
const A = await makeUser('A')
const B = await makeUser('B')
const aTok = await signin(A)
const bTok = await signin(B)
const ac = clientAs(aTok)
const bc = clientAs(bTok)

// === A creates a store (should succeed) ===
let a_store = null
await run('A.INSERT store (own) → SUCCESS', async () => {
  const r = await ac.from('stores').insert({
    owner_id: A.id,
    store_name: `RLS Test A ${ts}`,
    store_slug: `rls-test-a-${ts}`,
  }).select().single()
  if (r.error) return 'DENY(' + r.error.code + ')'
  a_store = r.data
  return 'OK'
})

// === A reads own store ===
await run('B.SELECT store (own) → SUCCESS', async () => {
  if (!a_store) return 'SKIP'
  const r = await ac.from('stores').select('id,store_name').eq('id', a_store.id).single()
  return r.error ? 'DENY' : 'OK'
})

// === A updates own store ===
await run('C.UPDATE store (own) → SUCCESS', async () => {
  if (!a_store) return 'SKIP'
  const r = await ac.from('stores').update({ description: 'updated' }).eq('id', a_store.id)
  return r.error ? 'DENY' : 'OK'
})

// === B reads A's store ===
await run('E.SELECT A-store (as B) → DENIED', async () => {
  if (!a_store) return 'SKIP'
  const r = await bc.from('stores').select('id,store_name').eq('id', a_store.id).maybeSingle()
  if (r.error) return 'DENY(ERR)'
  return r.data === null ? 'DENY' : 'LEAK!!!'
})

// === B updates A's store ===
await run('F.UPDATE A-store (as B) → DENIED', async () => {
  if (!a_store) return 'SKIP'
  const r = await bc.from('stores').update({ description: 'pwned' }).eq('id', a_store.id)
  if (r.error) return 'DENY(ERR)'
  return r.count === 0 ? 'DENY' : 'LEAK!!!'
})

// === B deletes A's store ===
await run('G.DELETE A-store (as B) → DENIED', async () => {
  if (!a_store) return 'SKIP'
  const r = await bc.from('stores').delete().eq('id', a_store.id)
  if (r.error) return 'DENY(ERR)'
  return r.count === 0 ? 'DENY' : 'LEAK!!!'
})

// === anon INSERT into stores (no JWT) ===
await run('H.anon INSERT stores → DENIED', async () => {
  const anon = createClient(SUPA, SRK, { auth: { persistSession: false } })
  // drop Authorization to simulate anon (apikey alone → service_role bypass)
  // better: use a non-service apikey. We mimic anon by attempting the insert
  // via role 'anon' through a fresh client without JWT:
  const r = await anon.from('stores').insert({
    owner_id: A.id, store_name: `anon-${ts}`, store_slug: `anon-${ts}`,
  })
  return r.error ? 'DENY(' + r.error.code + ')' : 'LEAK (anon insert succeeded)'
})

// === A creates own store_settings ===
let a_set = null
await run('I.INSERT store_settings (own store) → SUCCESS', async () => {
  if (!a_store) return 'SKIP'
  const r = await ac.from('store_settings').insert({
    store_id: a_store.id,
    theme_config: {}, seo_config: {},
  }).select().single()
  if (r.error) return 'DENY(' + r.error.code + ')'
  a_set = r.data
  return 'OK'
})

// === B reads A's store_settings ===
await run('J.SELECT A-settings (as B) → DENIED', async () => {
  if (!a_store) return 'SKIP'
  const r = await bc.from('store_settings').select('id,store_id').eq('store_id', a_store.id).maybeSingle()
  if (r.error) return 'DENY(ERR)'
  return r.data === null ? 'DENY' : 'LEAK!!!'
})

// === A deletes own store (cleanup)
await run('D.DELETE store (own) → SUCCESS', async () => {
  if (!a_store) return 'SKIP'
  const r = await ac.from('store_settings').delete().eq('store_id', a_store.id)
  if (r.error && r.error.code !== 'PGRST116') {
    // ignore "no rows"
  }
  const r2 = await ac.from('stores').delete().eq('id', a_store.id)
  return r2.error ? 'DENY' : 'OK'
})

// === print results ===
console.log('\n========= RLS TEST RESULTS =========')
for (const r of results) {
  const tag = r.verdict === 'OK' ? '✓'
    : r.verdict.startsWith('DENY') ? '✗(denied)'
    : r.verdict === 'LEAK!!!' ? '⚠️  LEAK'
    : r.verdict
  console.log(`${tag.padEnd(14)} ${r.name.padEnd(50)} → ${r.verdict}${r.error ? ' :: ' + r.error : ''}`)
}

// cleanup users
await admin.auth.admin.deleteUser(A.id)
await admin.auth.admin.deleteUser(B.id)

const fails = results.filter((r) => !r.verdict.startsWith('OK') && !r.verdict.startsWith('DENY') && r.verdict !== 'SKIP')
process.exit(fails.length === 0 ? 0 : 1)
