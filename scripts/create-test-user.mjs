// Create a Supabase test user via auth.admin (server-side).
// Uses .env.local's sb_secret_ key (service-role-equivalent in new Supabase API).
// Saves credentials to .diag-test-user.json (gitignored by convention).

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

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

const ts = Date.now()
const email = `diag-test-${ts}@omnilink.test`
const password = 'DiagP@ss_' + Math.random().toString(36).slice(2, 10)

console.log('[DIAG] Creating test user…')
console.log('  email   :', email)

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
})

if (error) {
  console.log('  ERROR   :', error.code ?? error.status, error.message)
  console.log('  >>> sb_secret_ key may not have admin scope; you may need to supply a test account.')
  process.exit(1)
}

console.log('  user.id :', data.user.id)
console.log('  created :', data.user.created_at)

writeFileSync('.diag-test-user.json', JSON.stringify({ email, password, user_id: data.user.id }, null, 2))
console.log('  creds   : saved to .diag-test-user.json')
