import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { extractMemoryDeclaration } from '../consumer-advisor/memory-lifecycle'
let db: PGlite
const user = '10000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql', 'utf8'))
  for (const name of ['20261024082331_eva_conversation_memory', '20261024082638_eva_memory_supports',
    '20261108150902_rename_consumer_ai_assistant_objects', '20261111020342_consumer_memory_confirmation'])
    await db.exec(await readFile(`supabase/migrations/${name}.sql`, 'utf8'))
  await db.exec(await readFile('supabase/tests/fixtures/stage23_catalog.sql', 'utf8'))
  for (const name of ['20261111030610_consumer_discovery_personal_context', '20261114073613_consumer_unified_execution',
    '20261115040000_consumer_memory_consolidation'])
    await db.exec(await readFile(`supabase/migrations/${name}.sql`, 'utf8'))
  await db.exec('set role service_role')
}, 30_000)
afterAll(async () => db?.close())
const manage = async (action: string, input: object) => (await db.query<{ result: { id: string; revision: number; status: string } }>(
  'select public.manage_consumer_memory($1,$2,$3) as result', [user, action, JSON.stringify(input)])).rows[0].result
async function source(text: string, role = 'user') {
  const id = crypto.randomUUID()
  await db.exec('reset role')
  await db.query('insert into public."consumer_AI assistant_messages"(id,user_id,conversation_id,role,content) values($1,$2,$3,$4,$5)',
    [id, user, crypto.randomUUID(), role, text])
  await db.exec('set role service_role')
  return id
}
async function consolidate(id: string, text: string, owner = user) {
  return (await db.query<{ result: { id: string; status: string } }>(
    'select public.consolidate_consumer_memory($1,$2,$3) as result', [owner, id, JSON.stringify(extractMemoryDeclaration(text))])).rows[0].result
}
const rows = async () => (await db.query<{ id: string; status: string; revision: number; source_payload: Record<string, unknown> }>(
  'select * from public."consumer_AI assistant_memories" where user_id=$1', [user])).rows

describe('memory consolidation in PostgreSQL', () => {
  it('merges evidence across conversations and never auto-confirms a proposal', async () => {
    const text = '我喜欢原木家具'
    const a = await source(text), b = await source(text)
    const proposal = await consolidate(a, text)
    expect(proposal.status).toBe('proposed')
    expect((await consolidate(b, text)).id).toBe(proposal.id)
    expect((await rows()).find((r) => r.id === proposal.id)?.source_payload.observations).toHaveLength(2)
    expect(await consolidate(a, text)).toEqual({ status: 'processed' })
  })
  it('requires confirmation before replacing a conflicting preference', async () => {
    const text = '我喜欢金属家具', negative = '我不喜欢金属家具'
    const a = await consolidate(await source(text), text)
    await manage('confirm', { id: a.id, revision: 1 })
    const b = await consolidate(await source(negative), negative)
    expect((await rows()).find((r) => r.id === a.id)?.status).toBe('active')
    await manage('confirm', { id: b.id, revision: 1 })
    expect((await rows()).find((r) => r.id === a.id)?.status).toBe('rejected')
    expect((await rows()).find((r) => r.id === b.id)?.status).toBe('active')
  })
  it('does not resurrect a forgotten source on retry', async () => {
    const text = '我喜欢蓝色', id = await source(text)
    const a = await consolidate(id, text)
    await manage('forget', { id: a.id, revision: 1 })
    expect(await consolidate(id, text)).toEqual({ status: 'processed' })
    expect((await rows()).find((r) => r.id === a.id)).toBeUndefined()
  })
  it('rejects stale conflict replacements after the user edits the original', async () => {
    const text = '我喜欢白色', negative = '我不喜欢白色'
    const a = await consolidate(await source(text), text)
    await manage('confirm', { id: a.id, revision: 1 })
    const b = await consolidate(await source(negative), negative)
    await manage('correct', { id: a.id, revision: 2, text: '只在夏天喜欢白色' })
    await expect(manage('confirm', { id: b.id, revision: 1 })).rejects.toMatchObject({ code: '40001' })
  })
  it('does not import another account or assistant output as user evidence', async () => {
    const text = '我喜欢绿色', id = await source(text)
    await expect(consolidate(id, text, other)).rejects.toMatchObject({ code: 'P0002' })
    await expect(consolidate(await source(text, 'assistant'), text)).rejects.toMatchObject({ code: 'P0002' })
  })
  it('excludes expired and third-party memories in database context snapshots', async () => {
    for (const lifecycle of [{ subject: 'other', scope: 'long-term', expiresAt: null },
      { subject: 'self', scope: 'temporary', expiresAt: '2000-01-01T00:00:00Z' }]) {
      await manage('manual', { text: `喜欢紫色 ${lifecycle.subject}`, domain: 'other', sourcePayload: { lifecycle } })
    }
    const result = (await db.query<{ value: { memories: { text: string }[] } }>(
      'select public.get_consumer_context_snapshot($1) as value', [user])).rows[0].value
    expect(result.memories.some((r) => r.text.includes('紫色'))).toBe(false)
  })
  it('invalidates dependent inferences and increments context version on expiry', async () => {
    const a = await manage('manual', { text: '喜欢短期体验', domain: 'other', sourcePayload: { lifecycle:
      { subject: 'self', scope: 'temporary', expiresAt: '2000-01-01T00:00:00Z' } } })
    const b = await manage('propose', { text: '可能喜欢尝试新事物', domain: 'other', origin: 'inferred', sourceKind: 'chat', supportIds: [a.id] })
    await manage('confirm', { id: b.id, revision: 1 })
    const before = (await db.query<{ version: number }>('select version from public.consumer_context_versions where user_id=$1', [user])).rows[0].version
    await db.query('select public.get_consumer_task_context($1,$2)', [user, ['other']])
    const after = (await db.query<{ version: number }>('select version from public.consumer_context_versions where user_id=$1', [user])).rows[0].version
    expect(Number(after)).toBeGreaterThan(Number(before))
    expect((await rows()).find((r) => r.id === b.id)?.status).toBe('rejected')
  })
  it('rejects malformed lifecycle metadata at the database boundary', async () => {
    await expect(manage('manual', { text: '无效时效', domain: 'other', sourcePayload: { lifecycle:
      { subject: 'self', scope: 'temporary', expiresAt: 'invalid' } } })).rejects.toMatchObject({ code: '23514' })
  })
  it('keeps the consolidation ledger and RPC unavailable to client roles', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      try {
        await expect(db.query('select * from public.consumer_memory_processed_sources')).rejects.toMatchObject({ code: '42501' })
        await expect(db.query('select public.consolidate_consumer_memory($1,$2,$3)', [user, crypto.randomUUID(), '{}'])).rejects.toMatchObject({ code: '42501' })
      } finally { await db.exec('reset role'); await db.exec('set role service_role') }
    }
  })
})
