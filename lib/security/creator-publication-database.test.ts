import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { publicationDefaults } from '../creator-publication-document'

const A = '10000000-0000-4000-8000-000000000001', B = '10000000-0000-4000-8000-000000000002'
const store = '30000000-0000-4000-8000-000000000001', org = '20000000-0000-4000-8000-000000000001'
const path = `${org}/${A}/40000000-0000-4000-8000-000000000001.webp`
const pendingPath = `${org}/${A}/40000000-0000-4000-8000-000000000002.webp`
const document = (title: string, asset = path, visibility = 'public') => ({ version: 1, kind: 'image', fields: { ...publicationDefaults, title, visibility }, media: [`/api/creator-posts/media/${asset}`], coverUrl: `/api/creator-posts/media/${asset}`, excerpt: title })
let db: PGlite
async function role<T>(user: string | null, action: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? ''])
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`)
  try { return await action() } finally { await db.exec('reset role') }
}
async function save(doc: unknown, status = 'published', id: string | null = null, paths = [path], user = A, action = 'save') {
  return role(user, async () => (await db.query<{ value: { id: string; status: string; publication: unknown; draft_version: unknown } }>('select to_jsonb(public.manage_creator_publication($1,$2,$3,$4,$5,$6)) value', [store, id, action, doc ? JSON.stringify(doc) : null, status, paths])).rows[0].value)
}
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql', 'utf8'))
  await db.exec('revoke all on function private.is_org_member(uuid,text[]) from public,anon; grant execute on function private.is_org_member(uuid,text[]) to authenticated;')
  for (const name of ['20261022015120_creator_content_posts', '20261022015412_creator_posts_store_scope', '20261022052325_creator_content_blocks', '20261111020201_secure_creator_draft_reads', '20261118014921_creator_publication_delivery', '20261118020341_creator_public_media_policy']) await db.exec(await readFile(`supabase/migrations/${name}.sql`, 'utf8'))
}, 30000)
afterAll(async () => { await db?.close() })
describe('publication transactions and public boundaries', () => {
  it('atomically publishes content and its media references', async () => {
    const row = await save(document('公开图文'))
    await role(null, async () => {
      expect((await db.query('select publication from public.creator_posts where id=$1', [row.id])).rows).toHaveLength(1)
      expect((await db.query('select path from public.creator_post_assets where post_id=$1', [row.id])).rows).toEqual([{ path }])
      await expect(db.query('select draft_version from public.creator_posts')).rejects.toMatchObject({ code: '42501' })
    })
    await save(document('未发布修改', pendingPath), 'draft', row.id, [pendingPath])
    await role(null, async () => {
      expect((await db.query<{ title: string }>('select title from public.creator_posts where id=$1', [row.id])).rows[0].title).toBe('公开图文')
      expect((await db.query('select path from public.creator_post_assets where path=$1', [pendingPath])).rows).toEqual([])
    })
    await save(document('更新后的图文', pendingPath), 'published', row.id, [pendingPath])
    await role(null, async () => expect((await db.query<{ title: string }>('select title from public.creator_posts where id=$1', [row.id])).rows[0].title).toBe('更新后的图文'))
    await save(null, 'draft', row.id, [], A, 'archive')
    await role(null, async () => expect((await db.query('select id from public.creator_posts where id=$1', [row.id])).rows).toEqual([]))
    await save(null, 'draft', row.id, [], A, 'restore')
    await role(null, async () => expect((await db.query('select id from public.creator_posts where id=$1', [row.id])).rows).toHaveLength(1))
  })
  it('keeps private posts and assets inaccessible to other accounts', async () => {
    const row = await save(document('私密内容', path, 'private'))
    await role(B, async () => {
      expect((await db.query('select id from public.creator_posts where id=$1', [row.id])).rows).toEqual([])
      expect((await db.query('select path from public.creator_post_assets where post_id=$1', [row.id])).rows).toEqual([])
      expect((await db.query('select * from public.get_creator_publication_for_editor($1,$2)', [store, row.id])).rows).toEqual([])
    })
    await expect(save(document('越权修改'), 'published', row.id, [path], B)).rejects.toMatchObject({ code: '42501' })
    await expect(save(document('跨空间素材'), 'published', null, [pendingPath.replace(org, '20000000-0000-4000-8000-000000000002')])).rejects.toMatchObject({ code: '42501' })
  })
  it('publishes scheduled posts and media only when the server clock is due', async () => {
    const doc = document('定时图文')
    const row = await save({ ...doc, fields: { ...doc.fields, timing: 'scheduled', scheduledAt: '2099-01-01T00:00:00Z' } }, 'scheduled')
    await role(null, async () => expect((await db.query('select id from public.creator_posts where id=$1', [row.id])).rows).toEqual([]))
    await db.query("update public.creator_posts set scheduled_at=now()-interval '1 minute' where id=$1", [row.id])
    expect((await db.query<{ count: number }>('select private.publish_due_creator_posts() count')).rows[0].count).toBe(1)
    await role(null, async () => expect((await db.query('select path from public.creator_post_assets where post_id=$1', [row.id])).rows).toHaveLength(1))
    await role(A, async () => { await expect(db.query('select private.publish_due_creator_posts()')).rejects.toMatchObject({ code: '42501' }) })
  })
})
