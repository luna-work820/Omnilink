// Try more endpoint variants.
import { readFileSync } from 'node:fs'

const env = {}
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i < 0) continue
  env[t.slice(0, i)] = t.slice(i + 1)
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const SRK = env.SUPABASE_SERVICE_ROLE_KEY
const hdr = { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' }

const paths = [
  ['GET',  '/pg/rpc/exec_sql', null],
  ['POST', '/pg/rpc/exec',     { sql: 'select 1' }],
  ['GET',  '/_/sql',           null],
  ['POST', '/_/sql',           { sql: 'select 1' }],
  ['POST', '/rest/v1/rpc/exec_sql', { sql: 'select 1' }],
]
for (const [m, p, body] of paths) {
  const opt = { method: m, headers: hdr }
  if (body) opt.body = JSON.stringify(body)
  const r = await fetch(URL + p, opt)
  const t = await r.text()
  console.log(`${m.padEnd(6)} ${p.padEnd(36)}  →  ${r.status}  ${t.slice(0, 250).replaceAll('\n', ' ')}`)
}
