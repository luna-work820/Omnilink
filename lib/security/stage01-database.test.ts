import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const A = '10000000-0000-4000-8000-000000000001'
const B = '10000000-0000-4000-8000-000000000002'
const storeA = '30000000-0000-4000-8000-000000000001'
const orgA = '20000000-0000-4000-8000-000000000001'
const path = `${orgA}/${A}/40000000-0000-4000-8000-000000000001.mp4`
const video = `/api/creator-posts/media/${path}`
const oldVideo = `https://example.supabase.co/storage/v1/object/public/creator-content-videos/${path}`
let db: PGlite
const migration = (name: string) => readFile(`supabase/migrations/${name}.sql`, 'utf8')

async function asRole<T>(role: 'anon' | 'authenticated' | 'service_role', userId: string | null, action: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId ?? ''])
  await db.exec(`set role ${role}`)
  try { return await action() } finally { await db.exec('reset role') }
}
async function manage(userId: string, action: string, input: Record<string, unknown>) {
  return asRole('service_role', null, async () => {
    const result = await db.query<{ memory: Record<string, any> }>(
      'select public.manage_consumer_memory($1::uuid,$2::text,$3::jsonb) as memory', [userId, action, JSON.stringify(input)])
    return result.rows[0].memory
  })
}
async function status(id: string) {
  const result = await db.query<{ status: string }>('select status from public."consumer_AI assistant_memories" where id=$1', [id])
  return result.rows[0]?.status
}

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql', 'utf8'))
  for (const name of ['20261022015120_creator_content_posts', '20261022015412_creator_posts_store_scope',
    '20261022052325_creator_content_blocks', '20261022074619_creator_content_videos',
    '20261024082331_eva_conversation_memory', '20261024082638_eva_memory_supports',
    '20261108150902_rename_consumer_ai_assistant_objects']) await db.exec(await migration(name))
  await db.query(`insert into public.creator_posts(id, organization_id, store_id, author_id, kind, title, status, blocks, draft_version)
    values ('50000000-0000-4000-8000-000000000001',$1,$2,$3,'note','Published','published',$4,$5)`,
  [orgA,storeA,A,JSON.stringify([{ id:'v',type:'video',url:oldVideo }]),JSON.stringify({ title:'Secret draft',blocks:[{ id:'v',type:'video',url:oldVideo }] })])
  await db.query(`insert into public.creator_posts(organization_id,store_id,author_id,kind,title,status)
    values ($1,$2,$3,'note','Private draft','draft')`, [orgA,storeA,A])
  await db.query(`insert into public."consumer_AI assistant_memories"(user_id,domain,text,origin)
    values ($1,'other','Legacy preference','inferred'),($1,'other',' legacy   preference ','user')`, [A])
  await db.exec('grant all on public.creator_posts to anon, authenticated')
  for (const name of ['20261111020201_secure_creator_draft_reads','20261111020342_consumer_memory_confirmation','20261111020348_private_creator_videos']) {
    await db.exec(await migration(name))
  }
}, 30000)
afterAll(async () => { await db?.close() })

describe('creator post permissions on PostgreSQL', () => {
  it.each([['anon',null],['authenticated',B]] as const)('%s may read published columns but never draft_version', async (role,user) => {
    await asRole(role,user,async () => {
      expect((await db.query('select id,title from public.creator_posts')).rows).toHaveLength(1)
      await expect(db.query('select draft_version from public.creator_posts')).rejects.toMatchObject({ code:'42501' })
      await expect(db.query('select * from public.creator_posts')).rejects.toMatchObject({ code:'42501' })
      expect((await db.query("select has_table_privilege(current_user,'public.creator_posts','TRUNCATE') as allowed")).rows).toEqual([{allowed:false}])
    })
  })
  it('lets editors read their drafts through the ownership checked RPC', async () => {
    await asRole('authenticated',A,async () => {
      const rows = (await db.query<{ draft_version: {title:string} | null }>('select * from public.get_creator_posts_for_editor($1)',[storeA])).rows
      expect(rows).toHaveLength(2)
      expect(rows.some((row) => row.draft_version?.title === 'Secret draft')).toBe(true)
      await db.query("update public.creator_posts set draft_version='{}' where title='Private draft'")
    })
    await asRole('authenticated',B,async () => {
      expect((await db.query('select * from public.get_creator_posts_for_editor($1)',[storeA])).rows).toHaveLength(0)
    })
    await asRole('anon',null,async () => {
      await expect(db.query('select * from public.get_creator_posts_for_editor($1)',[storeA])).rejects.toMatchObject({code:'42501'})
    })
  })
  it('keeps the video bucket private and converts published and pending video references idempotently', async () => {
    await db.exec(await migration('20261111020348_private_creator_videos'))
    expect((await db.query('select public from storage.buckets')).rows).toEqual([{public:false}])
    const row = (await db.query<{blocks:{url:string}[];draft_version:{blocks:{url:string}[]}}>("select blocks,draft_version from public.creator_posts where title='Published'")).rows[0]
    expect(row.blocks[0].url).toBe(video)
    expect(row.draft_version.blocks[0].url).toBe(video)
  })
})

describe('memory confirmation on PostgreSQL', () => {
  it('turns unverified legacy memory into deduplicated proposals', async () => {
    const rows = (await db.query<{status:string;confirmed_at:string|null}>('select status,confirmed_at from public."consumer_AI assistant_memories"')).rows
    expect(rows.filter((row) => row.status === 'proposed')).toHaveLength(1)
    expect(rows.every((row) => !row.confirmed_at)).toBe(true)
  })
  it('blocks direct client writes and service RPC impersonation', async () => {
    await asRole('authenticated',A,async () => {
      await expect(db.query(`insert into public."consumer_AI assistant_memories"(user_id,domain,text,original_text,origin) values ($1,'other','Bypass','Bypass','user')`,[A])).rejects.toMatchObject({code:'42501'})
      await expect(db.query(`update public."consumer_AI assistant_memories" set status='active'`)).rejects.toMatchObject({code:'42501'})
      await expect(db.query('select public.manage_consumer_memory($1,$2,$3)',[A,'manual','{}'])).rejects.toMatchObject({code:'42501'})
    })
    await asRole('authenticated',B,async () => {
      expect((await db.query('select id from public."consumer_AI assistant_memories"')).rows).toHaveLength(0)
    })
  })
  it('enforces the active-memory confirmation invariant even for trusted SQL callers', async () => {
    await expect(db.query(`insert into public."consumer_AI assistant_memories"(user_id,domain,text,original_text,origin,status)
      values ($1,'other','Unchecked active','Unchecked active','user','active')`,[A])).rejects.toMatchObject({code:'23514'})
  })
  it('requires confirmation for conversation and assessment proposals and preserves origin', async () => {
    for (const sourceKind of ['chat','assessment']) {
      const item = await manage(A,'propose',{ text:`Proposal ${sourceKind}`,domain:'other',origin:'inferred',sourceKind,evidence:'Original evidence' })
      expect(item.status).toBe('proposed')
      expect(item.confirmed_at).toBeNull()
      const confirmed = await manage(A,'confirm',{id:item.id,revision:item.revision})
      expect(confirmed).toMatchObject({status:'active',origin:'inferred',evidence:'Original evidence',confirmed_by:A,source_kind:sourceKind})
      expect(confirmed.confirmed_at).toBeTruthy()
      await expect(manage(B,'confirm',{id:item.id,revision:confirmed.revision})).rejects.toMatchObject({code:'P0002'})
      await expect(manage(A,'correct',{id:item.id,revision:item.revision,text:'Stale correction'})).rejects.toMatchObject({code:'40001'})
    }
  })
  it('replays normalized duplicate proposals without creating more rows', async () => {
    const input = {text:'Normalized preference',domain:'space',origin:'user',sourceKind:'chat',evidence:'Preference'}
    const first = await manage(A,'propose',input)
    const retry = await manage(A,'propose',{...input,text:' normalized   preference '})
    expect(retry.id).toBe(first.id)
    const saved = await manage(A,'manual',{text:'NORMALIZED preference',domain:'space'})
    expect(saved).toMatchObject({id:first.id,status:'active',origin:'user',source_kind:'chat'})
  })
  it('supersedes only after confirmation, including transitive inferences', async () => {
    const source = await manage(A,'manual',{text:'Original source',domain:'clothing'})
    const other = await manage(A,'manual',{text:'Second source',domain:'clothing'})
    const inferred = await manage(A,'propose',{text:'First inference',domain:'clothing',origin:'inferred',sourceKind:'chat',supportIds:[source.id,other.id]})
    const active = await manage(A,'confirm',{id:inferred.id})
    const dependent = await manage(A,'propose',{text:'Second inference',domain:'clothing',origin:'inferred',sourceKind:'chat',supportIds:[active.id,other.id]})
    await manage(A,'confirm',{id:dependent.id})
    const replacement = await manage(A,'propose',{text:'Replacement',domain:'clothing',origin:'user',sourceKind:'chat',supersedeIds:[source.id]})
    expect(await status(source.id)).toBe('active')
    expect(await status(active.id)).toBe('active')
    await manage(A,'confirm',{id:replacement.id})
    expect(await status(source.id)).toBe('rejected')
    expect(await status(active.id)).toBe('rejected')
    expect(await status(dependent.id)).toBe('rejected')
    expect(await status(replacement.id)).toBe('active')
  })
  it('rolls back a conflicting correction without losing prior memories', async () => {
    const one = await manage(A,'manual',{text:'Atomic one',domain:'hair'})
    await manage(A,'manual',{text:'Atomic two',domain:'hair'})
    await expect(manage(A,'correct',{id:one.id,text:'Atomic two'})).rejects.toMatchObject({code:'23505'})
    expect(await status(one.id)).toBe('active')
  })
  it('rejects foreign supports and excludes rejected records from the limit', async () => {
    const foreign = await manage(B,'manual',{text:'Foreign source',domain:'other'})
    await expect(manage(A,'propose',{text:'Invalid support',domain:'other',origin:'inferred',sourceKind:'chat',supportIds:[foreign.id]})).rejects.toMatchObject({code:'22023'})
    await db.query(`insert into public."consumer_AI assistant_memories"(user_id,domain,text,original_text,origin,status)
      select $1,'other','Rejected '||i,'Rejected '||i,'user','rejected' from generate_series(1,51) i`,[B])
    expect(await manage(B,'manual',{text:'Still allowed',domain:'other'})).toMatchObject({status:'active'})
  })
})
