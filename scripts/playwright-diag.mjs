// Playwright integration for diagnosing create-store failure.
// 1. Sign in via Supabase REST API (password grant) — get access/refresh tokens.
// 2. Inject Supabase session cookies into Chromium.
// 3. Visit /onboarding, fill store_name, submit.
// 4. Capture every page console + page error + Next-Action POST response.

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

// ---------- helpers ----------
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

// ---------- step 1: acquire session tokens via Supabase auth API ----------
console.log('[PW] Signing in via /auth/v1/token …')
const tokenRes = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
  },
  body: JSON.stringify({ email: cred.email, password: cred.password }),
})
if (!tokenRes.ok) {
  console.log('[PW] auth token error:', tokenRes.status, await tokenRes.text())
  process.exit(1)
}
const tokenData = await tokenRes.json()
console.log('[PW] got tokens. user_id =', tokenData.user?.id, 'expires_in =', tokenData.expires_in)
const access = tokenData.access_token
const refresh = tokenData.refresh_token
const expiresAt = Math.floor(Date.now() / 1000) + (tokenData.expires_in ?? 3600)

// ---------- step 2: launch chromium, inject cookies, navigate ----------
const SUPA_URL = new URL(env.NEXT_PUBLIC_SUPABASE_URL)
const cookieDomain = SUPA_URL.hostname

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  ignoreHTTPSErrors: true,
})

// Inject Supabase auth cookies (both legacy 'access_token' and current 'sb-*-auth-token')
await ctx.addCookies([
  {
    name: `${cookieDomain.split('.')[0]}-auth-token`,
    value: JSON.stringify([
      access,
      refresh,
      Number.isFinite(expiresAt) ? expiresAt : null,
      tokenData.user?.id ?? null,
    ]).replace(/"/g, '"'),
    domain: cookieDomain,
    path: '/',
    httpOnly: true,
    secure: true,
  },
  {
    name: 'sb-access-token',
    value: access,
    domain: cookieDomain,
    path: '/',
    httpOnly: false,
    secure: true,
  },
])

// Some setups also use a chunked cookie. We'll inspect cookies below to confirm.

const page = await ctx.newPage()

// Capture console messages
const consoleLines = []
page.on('console', (msg) => {
  const txt = `[console.${msg.type()}] ${msg.text()}`
  consoleLines.push(txt)
  console.log(txt)
})
// Capture page errors (uncaught exceptions on the page)
const pageErrors = []
page.on('pageerror', (err) => {
  pageErrors.push(err.toString())
  console.log('[pageerror]', err.toString())
})
// Capture all network responses for /onboarding POSTs
const actionResponses = []
page.on('response', async (resp) => {
  try {
    const url = resp.url()
    const headers = resp.headers()
    if (url.includes('/onboarding') || headers['next-action'] || headers['x-action']) {
      const body = await resp.text().catch(() => '<no body>')
      const entry = {
        url,
        status: resp.status(),
        method: resp.request().method(),
        nextAction: headers['next-action'],
        bodySnippet: body.slice(0, 800),
      }
      actionResponses.push(entry)
      console.log('[net]', entry.status, entry.method, url, 'Next-Action:', entry.nextAction)
    }
  } catch { /* ignore */ }
})

// step 3: visit /onboarding
console.log('[PW] Navigating to /onboarding …')
await page.goto('http://localhost:3000/onboarding', { waitUntil: 'networkidle', timeout: 30000 })

// Confirm we landed on the form
const hasForm = await page.locator('form').count()
console.log('[PW] form count =', hasForm)
if (hasForm === 0) {
  console.log('[PW] ⚠ no form found; dumping page snippet')
  console.log(await page.content().then(s => s.slice(0, 2000)))
  await browser.close()
  process.exit(1)
}

// step 4: fill & submit
console.log('[PW] Filling store_name and submitting …')
await page.fill('input[name="store_name"]', 'PW Diag Store')

// Trigger submit and wait for the response cycle
const navigationOrError = await Promise.race([
  page.waitForURL('**/dashboard', { timeout: 20000 }).then(() => ({ ok: true, kind: 'navigated' })).catch(e => ({ ok: false, kind: 'nav-fail', err: e.message })),
  page.waitForResponse(r => r.url().includes('/onboarding') && r.request().method() === 'POST', { timeout: 20000 }).then(r => ({ ok: true, kind: 'serverAction', status: r.status() })).catch(e => ({ ok: false, kind: 'no-action', err: e.message })),
  new Promise(res => setTimeout(() => res({ ok: false, kind: 'timeout-12s' }), 12000)),
])

// Click submit (this triggers the server action)
try {
  await page.click('button[type="submit"]', { timeout: 5000 })
  console.log('[PW] submit clicked')
} catch (e) {
  console.log('[PW] submit click error:', e.message)
}

await page.waitForTimeout(4000)  // give time for any /dashboard navigation or error UI

console.log('\n[PW] === Final URL ===', page.url())

// step 5: gather any error UI text
const errorText = await page.locator('[class*="red"], [class*="error"], [role="alert"]').allTextContents().catch(() => [])
console.log('[PW] === Visible error text ===')
for (const t of errorText) console.log('    ', t.replace(/\s+/g, ' ').trim())

console.log('\n[PW] === Summary ===')
console.log('  actionResponses :', actionResponses.length)
for (const r of actionResponses) console.log('  ▸', r.status, r.method, r.url, r.nextAction ? `Next-Action=${r.nextAction}` : '', '\n    body:', r.bodySnippet.slice(0, 400))
console.log('\n  console lines   :', consoleLines.length)
console.log('  page errors     :', pageErrors.length)

await browser.close()
