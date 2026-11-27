import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const fixturePath = '/tmp/omnilink-publication-qa-private.json'
const evidencePath = '/tmp/omnilink-publication-live-evidence.json'
const origin = 'http://127.0.0.1:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
assert.equal(new URL(url).hostname, 'fpypixbxsfpzrihwgmfk.supabase.co', 'This verification is scoped to omnilink-dev')
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
function checked(result) { if (result.error) throw new Error(result.error.message); return result.data }

if (process.argv.includes('--cleanup')) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  assert.ok(fixture.email.startsWith('publication-qa-') && fixture.email.endsWith('@omnilink.test'))
  const cleanupSession = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  checked(await cleanupSession.auth.signInWithPassword({ email: fixture.email, password: fixture.password }))
  checked(await cleanupSession.auth.signOut({ scope: 'global' }))
  const prefix = fixture.organizationId && fixture.userId ? `${fixture.organizationId}/${fixture.userId}` : null
  const uploaded = prefix ? checked(await admin.storage.from('creator-content-videos').list(prefix, { limit: 1000 })).filter((file) => file.id).map((file) => `${prefix}/${file.name}`) : []
  const assets = [...new Set([...(fixture.assets ?? []), ...uploaded])]
  assert.ok(assets.every((path) => prefix && path.startsWith(prefix + '/')))
  if (assets.length) checked(await admin.storage.from('creator-content-videos').remove(assets))
  if (fixture.organizationId) checked(await admin.from('organizations').delete().eq('id', fixture.organizationId))
  if (fixture.userId) checked(await admin.auth.admin.deleteUser(fixture.userId))
  await unlink(fixturePath)
  console.log('Removed only the publication verification account, space and assets.')
  process.exit(0)
}

const fixture = { email: `publication-qa-${randomUUID()}@omnilink.test`, password: randomBytes(24).toString('base64url') + 'Aa1!', userId: '', organizationId: '', storeId: '', assets: [], posts: {} }
const evidence = { checkedAt: new Date().toISOString(), checks: [] }
const pass = (check) => { evidence.checks.push(check); console.log('PASS:', check) }
const persist = () => writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600 })
try { await readFile(fixturePath); throw new Error('An unfinished verification fixture exists. Run --cleanup first.') } catch (error) { if (error.code !== 'ENOENT') throw error }
await persist()
const user = checked(await admin.auth.admin.createUser({ email: fixture.email, password: fixture.password, email_confirm: true, app_metadata: { creator_enabled: true, merchant_enabled: false }, user_metadata: { full_name: `发布连通测试-${randomUUID().slice(0, 8)}`, enabled_skills: [], signup_invitation_dismissed: true } }))
fixture.userId = user.user.id
await persist()
const cookies = new Map()
const session = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: (values) => { values.forEach(({ name, value }) => cookies.set(name, value)) } } })
checked(await session.auth.signInWithPassword({ email: fixture.email, password: fixture.password }))
const space = checked(await session.rpc('create_organization_and_store', { p_organization_name: '发布连通测试', p_organization_slug: `publication-qa-${fixture.userId}`, p_store_name: '发布连通测试', p_store_slug: `publication-qa-${fixture.userId}`, p_currency: 'CNY' }))[0]
fixture.organizationId = space.organization_id; fixture.storeId = space.store_id
await persist()
checked(await admin.from('stores').update({ status: 'active' }).eq('id', fixture.storeId))
checked(await session.from('brand_projects').insert({ user_id: fixture.userId, name: '发布连通测试', style: 'y2k', status: 'active', selected_template: 'tpl-y2k-neon', palette: [], analysis: { source: 'publication-qa' } }))
const cookieHeader = () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; ')
async function api(path, method = 'GET', body) {
  const response = await fetch(origin + path, { method, headers: { Cookie: cookieHeader(), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const text = await response.text()
  let result
  try { result = JSON.parse(text) } catch { throw new Error(`API ${path}: ${response.status}, non-JSON response`) }
  if (!response.ok) throw new Error(`API ${path}: ${response.status}, ${result.error ?? 'unknown error'}`)
  return result
}
async function upload(fileName, contentType) {
  const bytes = await readFile(fileName)
  const ticket = await api('/api/creator-posts/media', 'POST', { contentType, size: bytes.length })
  checked(await session.storage.from('creator-content-videos').uploadToSignedUrl(ticket.path, ticket.token, bytes, { contentType }))
  fixture.assets.push(ticket.path); await persist()
  return ticket.url
}
const fields = { title: '', summary: '', topics: '', collection: '', declaration: '', location: '', visibility: 'public', allowSave: true, timing: 'now', scheduledAt: '' }
const imagePath = 'public/consumer-market/ssd-import/cat-paw-slippers.webp'
const cover = await upload(imagePath, 'image/webp')
let imageDoc = { version: 1, kind: 'image', fields: { ...fields, title: '图文正式连通测试', summary: '通过正式接口发布的测试图文。' }, media: [cover], coverUrl: cover }
let record = (await api('/api/creator-publications', 'POST', { document: imageDoc, status: 'published' })).record
fixture.posts.image = record.id; await persist()
assert.equal((await api(`/api/creator-publications?id=${record.id}`)).record.content.fields.title, imageDoc.fields.title)
assert.ok((await api('/api/creator-posts')).posts.some((post) => post.id === record.id))
assert.equal(checked(await anon.from('creator_posts').select('id').eq('id', record.id)).length, 1)
assert.equal((await fetch(origin + cover, { redirect: 'manual' })).status, 307)
pass('image publish, editor restore, management list and anonymous media access')

const pendingCover = await upload(imagePath, 'image/webp')
const pendingDoc = { ...imageDoc, fields: { ...imageDoc.fields, title: '图文更新连通测试' }, media: [pendingCover], coverUrl: pendingCover }
await api('/api/creator-publications', 'PATCH', { id: record.id, document: pendingDoc, status: 'draft' })
assert.equal(checked(await anon.from('creator_posts').select('title').eq('id', record.id))[0].title, imageDoc.fields.title)
assert.equal((await fetch(origin + pendingCover, { redirect: 'manual' })).status, 404)
assert.equal((await api(`/api/creator-publications?id=${record.id}`)).record.pending.fields.title, pendingDoc.fields.title)
pass('unpublished changes and their new media stay private')
await api('/api/creator-publications', 'PATCH', { id: record.id, document: pendingDoc, status: 'published' })
imageDoc = pendingDoc
assert.equal((await fetch(origin + pendingCover, { redirect: 'manual' })).status, 307)
assert.equal((await fetch(origin + cover, { redirect: 'manual' })).status, 404)
pass('confirmed update switches content and media permissions together')

const privateDoc = { ...imageDoc, fields: { ...imageDoc.fields, title: '私密正式连通测试', visibility: 'private' } }
fixture.posts.private = (await api('/api/creator-publications', 'POST', { document: privateDoc, status: 'published' })).record.id
assert.equal(checked(await anon.from('creator_posts').select('id').eq('id', fixture.posts.private)).length, 0)
pass('private publication excluded by database public policy')

const video = await upload('public/consumer-market/ssd-import/cat-paw-slippers.mp4', 'video/mp4')
fixture.posts.video = (await api('/api/creator-publications', 'POST', { document: { version: 1, kind: 'video', fields: { ...fields, title: '视频正式连通测试', summary: '通过正式上传与播放接口验证。' }, media: [video], coverUrl: cover }, status: 'published' })).record.id
assert.equal((await fetch(origin + video, { redirect: 'manual' })).status, 307)
pass('video signed upload, publication and authorized playback')

const articleTitle = '文章正式连通测试'
const article = { version: 2, title: articleTitle, background: 'blue-2', cover: { url: cover, position: 68 }, updatedAt: Date.now(), blocks: [
  { id: randomUUID(), type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: '长文排版连通', styles: {} }], children: [] },
  { id: randomUUID(), type: 'paragraph', content: [{ type: 'text', text: '文章背景、封面位置和正文部件会保留到正式阅读页。', styles: {} }], children: [] },
  { id: randomUUID(), type: 'productLink', props: { url: 'https://example.com/product', name: '商品卡片连通测试', price: '¥99', image: cover }, children: [] },
] }
fixture.posts.article = (await api('/api/creator-publications', 'POST', { document: { version: 1, kind: 'article', fields: { ...fields, title: articleTitle }, media: [], coverUrl: cover, article }, status: 'published' })).record.id
assert.equal((await api(`/api/creator-publications?id=${fixture.posts.article}`)).record.content.article.cover.position, 68)
const page = await fetch(`${origin}/discover?post=${fixture.posts.article}`, { headers: { Cookie: cookieHeader() } })
const html = await page.text()
assert.equal(page.status, 200)
assert.ok(html.includes(articleTitle), 'server discovery response contains the published article')
pass('article layout, product card and server discovery projection')

const scheduledCover = await upload(imagePath, 'image/webp')
const scheduled = { ...imageDoc, media: [scheduledCover], coverUrl: scheduledCover, fields: { ...imageDoc.fields, title: '定时正式连通测试', timing: 'scheduled', scheduledAt: new Date(Date.now() + 120000).toISOString() } }
fixture.posts.scheduled = (await api('/api/creator-publications', 'POST', { document: scheduled, status: 'scheduled' })).record.id
assert.equal((await fetch(origin + scheduledCover, { redirect: 'manual' })).status, 404)
checked(await admin.from('creator_posts').update({ scheduled_at: new Date(Date.now() - 60000).toISOString() }).eq('id', fixture.posts.scheduled).eq('author_id', fixture.userId))
console.log('Waiting for the actual minute scheduler to publish the scoped test record…')
let due = false
for (let attempt = 0; attempt < 35; attempt++) {
  const rows = checked(await anon.from('creator_posts').select('id').eq('id', fixture.posts.scheduled))
  if (rows.length) { due = true; break }
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
assert.ok(due, 'scheduled record becomes publicly visible through the real cron job')
assert.equal((await fetch(origin + scheduledCover, { redirect: 'manual' })).status, 307)
pass('actual scheduled job publishes both the record and its media')
await api('/api/creator-publications', 'PATCH', { id: fixture.posts.scheduled, action: 'archive' })
assert.equal((await fetch(origin + scheduledCover, { redirect: 'manual' })).status, 404)
await api('/api/creator-publications', 'PATCH', { id: fixture.posts.scheduled, action: 'restore' })
assert.equal((await fetch(origin + scheduledCover, { redirect: 'manual' })).status, 307)
pass('archive withdraws media access and restore reinstates it')
await persist()
await writeFile(evidencePath, JSON.stringify(evidence, null, 2))
console.log('Live verification passed. Scoped fixtures are ready for browser review; use --cleanup afterwards.')
