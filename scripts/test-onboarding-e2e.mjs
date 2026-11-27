// Test A / Test B end-to-end: drives Next.js dev server via Playwright with
// a real Supabase session. Proves the P0 fix (redirect outside try/catch)
// makes createStoreAction actually navigate to /dashboard.
//
// Test A: store_name='Omnilink P0 Empty Industry', industry_category=''
// Test B: store_name='Omnilink P0 Eyewear', industry_category='Eyewear'

import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 1) Get a test user (create or reuse)
let creds
if (existsSync('.diag-test-user.json')) {
  creds = JSON.parse(readFileSync('.diag-test-user.json', 'utf8'))
  console.log('[TEST] reusing user:', creds.email)
} else {
  console.log('[TEST] creating fresh test user…')
  const ts = Date.now()
  const email = `p0-test-${ts}@omnilink.test`
  const password = 'P0Test_' + Math.random().toString(36).slice(2, 10)
  const supabaseAdmin = createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: `P0测试-${ts}` },
  })
  if (error) {
    console.log('[TEST] FATAL: cannot create test user:', error.message)
    process.exit(1)
  }
  creds = { email, password, user_id: data.user.id }
  writeFileSync('.diag-test-user.json', JSON.stringify(creds, null, 2))
  console.log('[TEST] created user:', creds.user_id)
}

// 2) Sign in via Supabase's token endpoint to get a real session
const sessionResp = await fetch(
  `${SUPA_URL}/auth/v1/token?grant_type=password`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPA_KEY,
    },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  }
)
const sessionJson = await sessionResp.json()
if (!sessionJson.access_token) {
  console.log('[TEST] FATAL: sign-in failed:', JSON.stringify(sessionJson).slice(0, 300))
  process.exit(1)
}
console.log('[TEST] signed in, expires_in:', sessionJson.expires_in)

// 3) Build the Supabase auth cookie value (same format @supabase/ssr uses).
// Reference: supabase/lib uses cookie name `sb-<project-ref>-auth-token`.
// project-ref is the host segment before .supabase.co.
const projRef = new URL(SUPA_URL).hostname.split('.')[0]
const cookieName = `sb-${projRef}-auth-token`
const cookieValue = JSON.stringify({
  access_token: sessionJson.access_token,
  refresh_token: sessionJson.refresh_token,
  expires_in: sessionJson.expires_in,
  expires_at: Math.floor(Date.now() / 1000) + sessionJson.expires_in,
  token_type: 'bearer',
  user: sessionJson.user,
})
console.log('[TEST] cookie:', cookieName, '(project', projRef, ')')

// 4) Launch headless Chromium and visit /onboarding with auth cookie
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
await context.addCookies([{
  name: cookieName,
  value: cookieValue,
  domain: 'localhost',
  path: '/',
  httpOnly: false,
  secure: false,
  sameSite: 'Lax',
}])

const TESTS = [
  { name: 'Test A', store: 'Omnilink P0 Empty Industry', industry: '' },
  { name: 'Test B', store: 'Omnilink P0 Eyewear', industry: 'Eyewear' },
]

const results = []
for (const t of TESTS) {
  console.log(`\n[${t.name}] starting: store=${t.store} industry=${JSON.stringify(t.industry)}`)
  const page = await context.newPage()
  const consoleErrs = []
  page.on('pageerror', (e) => consoleErrs.push(String(e)))
  page.on('response', (r) => {
    if (r.status() >= 400) console.log(`  ${r.status()} ${r.url().slice(0, 80)}`)
  })

  try {
    await page.goto('http://localhost:3000/onboarding', { waitUntil: 'domcontentloaded', timeout: 15000 })
    console.log(`  page loaded, url=${page.url()}`)

    await page.fill('input[name="store_name"]', t.store)

    if (t.industry) {
      // IndustrySelector renders a controlled <input> (no name attr).
      // It's the second text input on the page (after store_name).
      const industryInput = page.locator('input').nth(1)
      if (await industryInput.count() > 0) {
        await industryInput.fill(t.industry)
        console.log(`  industry filled: "${t.industry}"`)
      } else {
        console.log('  WARN: no industry input found')
      }
    }

    // Submit and wait for navigation
    await Promise.all([
      page.waitForURL((u) => u.pathname === '/dashboard' || u.pathname.startsWith('/dashboard'), { timeout: 20000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ])

    const finalUrl = page.url()
    const pathname = new URL(finalUrl).pathname
    console.log(`  final URL: ${finalUrl}`)

    const pass = pathname === '/dashboard' || pathname.startsWith('/dashboard')
    results.push({ test: t.name, store: t.store, industry: t.industry, finalUrl, pass, errors: consoleErrs })
  } catch (e) {
    console.log(`  EXCEPTION:`, e.message.split('\n')[0])
    results.push({ test: t.name, store: t.store, industry: t.industry, finalUrl: page.url(), pass: false, errors: [String(e), ...consoleErrs] })
  }
  await page.close()
}

await browser.close()

console.log('\n========= RESULTS =========')
for (const r of results) {
  console.log(`${r.pass ? '✓' : '✗'} ${r.test}: store=${r.store}, industry=${JSON.stringify(r.industry)}, finalUrl=${r.finalUrl}`)
  if (r.errors.length) console.log('   errors:', r.errors.slice(0, 3))
}

writeFileSync('scripts/.test-results.json', JSON.stringify(results, null, 2))
console.log('\nSaved to scripts/.test-results.json')

const allPass = results.every((r) => r.pass)
process.exit(allPass ? 0 : 1)
