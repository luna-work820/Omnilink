import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {beforeAll,afterAll,describe,it,expect} from 'vitest'
let db:PGlite
const user='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',store='30000000-0000-4000-8000-000000000001'
beforeAll(async()=>{
 db=await PGlite.create();await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql','utf8'))
 await db.exec(`alter table public.stores add column status text default 'active'; update public.stores set slug='store-a' where id='${store}'; update public.organization_members set role='owner' where user_id='${user}'; grant select on public.stores,public.organization_members to service_role;`)
 await db.exec(await readFile('supabase/migrations/20261116072939_ai_website_builder.sql','utf8'));await db.exec('set role service_role')
},30000)
afterAll(async()=>db?.close())
const run=async(action:string,payload:object,who:string|null=user)=>(await db.query<{result:Record<string,unknown>}>('select public.manage_ai_website($1,$2,$3,$4) result',[who,store,action,JSON.stringify(payload)])).rows[0].result
let id:string
const source={id:'a'.repeat(64),dataVersion:'1',runtimeVersion:'1',files:{}}
describe('one website per merchant with fenced builds',()=>{
 it('reserves one site and one running task, with idempotent retries',async()=>{
  const requestId=crypto.randomUUID();const result=await run('start',{requestId,prompt:'创建网站',baseBuildId:null});id=String(result.id)
  expect((await run('start',{requestId,prompt:'创建网站',baseBuildId:null})).id).toBe(id)
  await expect(run('start',{requestId,prompt:'不同指令',baseBuildId:null})).rejects.toMatchObject({code:'40001'})
  await expect(run('start',{requestId:crypto.randomUUID(),prompt:'另一个网站',baseBuildId:null})).rejects.toMatchObject({message:'WEBSITE_BUSY'})
  expect((await db.query('select count(*)::int n from public.ai_websites')).rows[0].n).toBe(1)
 })
 it('denies another organization and client RPC calls',async()=>{
  await expect(run('cancel',{buildId:id,expectedRevision:0},other)).rejects.toMatchObject({code:'42501'})
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await expect(run('cancel',{buildId:id,expectedRevision:0})).rejects.toMatchObject({code:'42501'});await db.exec('set role service_role')}
 })
 it('only advances a ready build to draft, and rejects missing artifacts',async()=>{
  await run('building',{buildId:id,expectedRevision:0,source})
  await expect(run('finish',{buildId:id,expectedRevision:1,artifactDigest:null,artifacts:null})).rejects.toMatchObject({code:'23514'})
  await run('finish',{buildId:id,expectedRevision:1,artifacts:{'site.js':'example'},artifactDigest:'b'.repeat(64)})
  expect((await db.query('select draft_build_id from public.ai_websites where store_id=$1',[store])).rows[0].draft_build_id).toBe(id)
 })
 it('rejects stale source baselines and late writes after cancellation',async()=>{
  await expect(run('start',{requestId:crypto.randomUUID(),prompt:'修改首页',baseBuildId:null})).rejects.toMatchObject({code:'40001'})
  const result=await run('start',{requestId:crypto.randomUUID(),prompt:'修改首页',baseBuildId:id});const buildId=result.id
  await run('cancel',{buildId,expectedRevision:0})
  await expect(run('building',{buildId,expectedRevision:0,source})).rejects.toMatchObject({code:'40001'})
  expect((await db.query('select count(*)::int n from public.ai_websites')).rows[0].n).toBe(1)
 })
 it('allows editors to build but denies publication',async()=>{
  await db.exec("reset role");await db.query("update public.organization_members set role='editor' where user_id=$1",[user]);await db.exec('set role service_role')
  try{await expect(run('publish',{buildId:id})).rejects.toMatchObject({code:'42501'})}
  finally{await db.exec('reset role');await db.query("update public.organization_members set role='owner' where user_id=$1",[user]);await db.exec('set role service_role')}
 })
 it('expires abandoned tasks without replacing the last ready draft',async()=>{
  const task=await run('start',{requestId:crypto.randomUUID(),prompt:'修改网站',baseBuildId:id})
  await db.query("update public.ai_website_builds set deadline_at=now()-interval '1 minute' where id=$1",[task.id])
  await run('expire',{})
  expect((await db.query('select status from public.ai_website_builds where id=$1',[task.id])).rows[0].status).toBe('failed')
  expect((await db.query('select draft_build_id from public.ai_websites')).rows[0].draft_build_id).toBe(id)
  await expect(run('building',{buildId:task.id,expectedRevision:0,source})).rejects.toMatchObject({code:'40001'})
 })
 it('records publish/unpublish and rejects unpublished rollback',async()=>{
  await run('publish',{buildId:id})
  expect((await db.query('select published_build_id from public.ai_websites')).rows[0].published_build_id).toBe(id)
  await run('unpublish',{});await run('rollback',{buildId:id})
  expect((await db.query('select count(*)::int n from public.ai_website_releases')).rows[0].n).toBe(3)
 })
 it('leases runtime by mode and fences a stale lease',async()=>{
  const r=await run('runtime_claim',{buildId:id,mode:'preview',lease:'lease-a'});expect(r.claimed).toBe(true)
  expect((await run('runtime_claim',{buildId:id,mode:'preview',lease:'lease-b'})).claimed).toBe(false)
  await expect(run('runtime_commit',{buildId:id,mode:'preview',lease:'wrong',runtime:{}})).rejects.toMatchObject({code:'40001'})
  await run('runtime_commit',{buildId:id,mode:'preview',lease:'lease-a',runtime:{lease:'lease-a',url:'https://example.com',expiresAt:new Date(Date.now()+60000).toISOString()}})
 })
})
