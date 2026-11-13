import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest'

const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002'
const session='60000000-0000-4000-8000-000000000001',otherSession='60000000-0000-4000-8000-000000000002'
const guest='a'.repeat(64)
const product=(n:number)=>`40000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const spec={query:'沙发',termGroups:[['沙发','sofa','couch']],excludedTerms:[],minPrice:null,maxPrice:null,currency:'CNY',type:'商品',sessionTerms:[],questionDismissed:false}
let db:PGlite
async function role<T>(name:'anon'|'authenticated'|'service_role',userId:string|null,action:()=>Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[userId??''])
  await db.exec(`set role ${name}`)
  try{return await action()}finally{await db.exec('reset role')}
}
async function candidates(input:Record<string,unknown>=spec,positive:string[]=[],avoid:string[]=[]) {
  return role('service_role',null,async()=>(await db.query<{id:string}>(
    'select * from public.search_consumer_discovery_candidates($1,$2,$3)',[JSON.stringify(input),positive,avoid])).rows.map((r)=>r.id))
}
async function version(userId=A) {
  return role('service_role',null,async()=>(await db.query<{snapshot:{version:number;memories:Record<string,any>[]}}>(
    'select public.get_consumer_context_snapshot($1) as snapshot',[userId])).rows[0].snapshot)
}
async function manage(action:string,input:Record<string,unknown>,userId=A) {
  return role('service_role',null,async()=>(await db.query<{memory:Record<string,any>}>(
    'select public.manage_consumer_memory($1,$2,$3) as memory',[userId,action,JSON.stringify(input)])).rows[0].memory)
}
async function run(input=spec,userId:string|null=A,guestHash:string|null=null,ids?:string[]) {
  const id=crypto.randomUUID(),v=userId?(await version(userId)).version:0
  const record={id,user_id:userId,guest_hash:guestHash,session_id:session,spec:input,candidate_ids:ids??await candidates(input),context_version:v,expires_at:new Date(Date.now()+600_000).toISOString()}
  await role('service_role',null,()=>db.query('select public.create_consumer_discovery_run($1)',[JSON.stringify(record)]))
  return {id,version:v}
}
async function page(r:{id:string;version:number},offset=0,userId:string|null=A,guestHash:string|null=null,sessionId=session) {
  return role('service_role',null,async()=>(await db.query<{page:{rows:{id:string;price_mode:string}[];nextOffset:number|null;candidateCount:number}}>(
    'select public.page_consumer_discovery_run($1,$2,$3,$4,$5,$6) as page',[r.id,userId,guestHash,sessionId,offset,r.version])).rows[0].page)
}
beforeAll(async()=>{
  db=await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql','utf8'))
  for(const name of ['20261024082331_eva_conversation_memory','20261024082638_eva_memory_supports',
    '20261108150902_rename_consumer_ai_assistant_objects','20261111020342_consumer_memory_confirmation'])
    await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'))
  await db.exec(await readFile('supabase/tests/fixtures/stage23_catalog.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20261111030610_consumer_discovery_personal_context.sql','utf8'))
},30_000)
beforeEach(async()=>{
  await db.exec(`truncate public.consumer_discovery_runs,public."consumer_AI assistant_memories",public.consumer_context_versions;
    truncate public.catalog_items cascade;
    insert into auth.users(id) values('${B}') on conflict do nothing;
    update public.stores set status='active',deleted_at=null;
    update public.sales_channels set status='active';
    insert into public.catalog_items(id,organization_id,title,description,created_at,details)
    select ('40000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
      '沙发 '||n,case when n%2=0 then '简约 木质' else '复古 布艺' end,'2026-01-01'::timestamptz+n*interval '1 minute',
      '{"outbound_links":{"xiaohongshu":"https://www.xiaohongshu.com/explore/test-fixture"}}'::jsonb from generate_series(1,45) n;
    insert into public.catalog_variants(organization_id,catalog_item_id,price,currency_code)
      select organization_id,id,100,'CNY' from public.catalog_items;
    insert into public.catalog_item_channels(organization_id,catalog_item_id,channel_id,store_id)
      select organization_id,id,'50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001' from public.catalog_items;`)
})
afterAll(async()=>{await db?.close()})

describe('discovery pagination on PostgreSQL',()=>{
  it('returns 20 then 20 then 5 without repeats, regardless of a new publication',async()=>{
    const r=await run(),first=await page(r)
    expect(first.rows).toHaveLength(20)
    await db.query(`insert into public.catalog_items(id,organization_id,title,details) select $1,organization_id,'沙发 New',details from public.catalog_items limit 1`,[product(99)])
    await db.query(`insert into public.catalog_item_channels(organization_id,catalog_item_id,channel_id,store_id)
      select organization_id,$1,channel_id,store_id from public.catalog_item_channels limit 1`,[product(99)])
    const second=await page(r,first.nextOffset!),third=await page(r,second.nextOffset!)
    expect(second.rows).toHaveLength(20);expect(third.rows).toHaveLength(5);expect(third.nextOffset).toBeNull()
    const ids=[...first.rows,...second.rows,...third.rows].map((p)=>p.id)
    expect(new Set(ids).size).toBe(45);expect(ids).not.toContain(product(99))
    expect((await page(r)).rows).toEqual(first.rows)
  })
  it('fills holes from unpublished products while preserving snapshot order',async()=>{
    const ids=await candidates(),r=await run(spec,A,null,ids),first=await page(r)
    await db.query('update public.catalog_item_channels set is_visible=false where catalog_item_id=$1',[ids[20]])
    const second=await page(r,first.nextOffset!)
    expect(second.rows.map((p)=>p.id)).toEqual(ids.slice(21,41))
    expect(second.nextOffset).toBe(41)
    await db.query("update public.catalog_items set status='draft'")
    expect((await page(r,second.nextOffset!)).rows).toHaveLength(0)
  })
  it('distinguishes zero matches from expired or wrong-owner searches',async()=>{
    const none=await run({...spec,query:'不存在',termGroups:[['不存在']]})
    expect((await page(none)).rows).toHaveLength(0)
    const r=await run()
    await expect(page(r,0,B)).rejects.toMatchObject({code:'P0002'})
    await expect(page(r,0,A,null,otherSession)).rejects.toMatchObject({code:'P0002'})
    await db.query("update public.consumer_discovery_runs set expires_at=now()-interval '1 second' where id=$1",[r.id])
    await expect(page(r)).rejects.toMatchObject({message:'SEARCH_EXPIRED'})
  })
  it('isolates guest cookies from accounts and other guests',async()=>{
    const r=await run(spec,null,guest)
    expect((await page(r,0,null,guest)).rows).toHaveLength(20)
    await expect(page(r,0,null,'b'.repeat(64))).rejects.toMatchObject({code:'P0002'})
    await expect(page(r,0,A,guest)).rejects.toMatchObject({code:'P0002'})
    await expect(run(spec,null,null)).rejects.toMatchObject({code:'23514'})
  })
  it('keeps current material, exclusions, price and type constraints ahead of confirmed preferences',async()=>{
    const ids=await candidates({...spec,termGroups:[['沙发','sofa'],['木质']],excludedTerms:['布艺'],maxPrice:150},['复古','布艺'])
    expect(ids).toHaveLength(22);expect(ids.every((id)=>Number(id.slice(-12))%2===0)).toBe(true)
    await db.query("update public.catalog_items set item_type='service' where id=$1",[product(2)])
    expect(await candidates()).not.toContain(product(2))
    expect(await candidates({...spec,type:'服务'})).toEqual([product(2)])
  })
  it('includes free products, excludes unknown and inquiry prices from a budget and respects currency',async()=>{
    await db.query("update public.catalog_variants set price=null where catalog_item_id=$1",[product(1)])
    await db.query("update public.catalog_items set details=details||'{\"price_mode\":\"free\"}' where id=$1",[product(2)])
    await db.query("update public.catalog_items set details=details||'{\"price_mode\":\"inquiry\"}' where id=$1",[product(3)])
    await db.query("update public.catalog_variants set currency_code='USD' where catalog_item_id=$1",[product(4)])
    const ids=await candidates({...spec,maxPrice:150})
    expect(ids).toContain(product(2));expect(ids).not.toContain(product(1));expect(ids).not.toContain(product(3));expect(ids).not.toContain(product(4))
    expect(await candidates()).toHaveLength(45)
    expect(await candidates({...spec,maxPrice:0})).toEqual([product(2)])
    expect(await candidates({...spec,minPrice:1})).not.toContain(product(2))
  })
  it('shows only the public projection and denies clients the service RPCs',async()=>{
    await db.query("update public.catalog_items set status='draft' where id=$1",[product(1)])
    await role('anon',null,async()=>{
      expect((await db.query('select * from public.discovery_products')).rows).toHaveLength(44)
      await expect(db.query('select * from public.catalog_items')).rejects.toMatchObject({code:'42501'})
      await expect(db.query('select * from public.consumer_discovery_runs')).rejects.toMatchObject({code:'42501'})
      await expect(db.query('select public.get_consumer_context_snapshot($1)',[A])).rejects.toMatchObject({code:'42501'})
      await expect(db.query('select * from public.search_consumer_discovery_candidates($1,$2,$3)',[JSON.stringify(spec),[],[]])).rejects.toMatchObject({code:'42501'})
    })
    await role('authenticated',B,async()=>{
      expect((await db.query('select * from public.consumer_context_versions')).rows).toHaveLength(0)
      await expect(db.query('select public.create_consumer_discovery_run($1)',['{}'])).rejects.toMatchObject({code:'42501'})
    })
  })
  it('excludes invalid links and soft-deleted stores before counting a page',async()=>{
    await db.query("update public.catalog_items set details='{\"outbound_links\":{\"xiaohongshu\":\"https://example.com/invalid\"}}' where id=$1",[product(1)])
    expect(await candidates()).toHaveLength(44)
    await db.exec("update public.stores set deleted_at=now()")
    expect(await candidates()).toEqual([])
  })
})

describe('versioned personal context on PostgreSQL',()=>{
  it('changes the version only when confirmed memory changes and invalidates cursors atomically',async()=>{
    const r=await run()
    const proposal=await manage('propose',{text:'偏好木质家具',domain:'space',origin:'user',sourceKind:'chat'})
    expect((await version()).version).toBe(0);expect((await version()).memories).toEqual([])
    await page(r)
    const active=await manage('confirm',{id:proposal.id,revision:proposal.revision})
    expect((await version()).version).toBe(1)
    await expect(page(r)).rejects.toMatchObject({code:'40001'})
    const current=await run()
    await manage('forget',{id:active.id,revision:active.revision})
    expect((await version()).version).toBe(2)
    await expect(page(current)).rejects.toMatchObject({code:'40001'})
    expect((await version(B)).version).toBe(0)
  })
  it('retains separate retest evidence even with identical summaries and replaces it only on confirmation',async()=>{
    const input={text:'相同评测摘要',domain:'other',origin:'inferred',sourceKind:'assessment'}
    const first=await manage('propose',{...input,sourcePayload:{assessmentId:'first',answers:{E1:['极简']},preferenceSignals:{positiveTerms:['minimal']}}})
    const active=await manage('confirm',{id:first.id,revision:1})
    const second=await manage('propose',{...input,sourcePayload:{assessmentId:'second',answers:{E1:['复古']},preferenceSignals:{positiveTerms:['vintage']}}})
    expect(second.id).not.toBe(first.id)
    expect((await version()).memories.map((m)=>m.id)).toEqual([first.id])
    await manage('confirm',{id:second.id,revision:1})
    expect((await version()).memories.map((m)=>m.id)).toEqual([second.id])
    expect((await db.query<{status:string}>('select status from public."consumer_AI assistant_memories" where id=$1',[active.id])).rows[0].status).toBe('rejected')
  })
  it('clears applied assessment signals on correction while preserving original evidence',async()=>{
    const proposal=await manage('propose',{text:'极简风格',domain:'other',origin:'inferred',sourceKind:'assessment',
      sourcePayload:{assessmentId:'a',answers:{E1:['极简']},preferenceSignals:{positiveTerms:['minimal'],avoidTerms:[]}}})
    const corrected=await manage('correct',{id:proposal.id,revision:1,text:'现在更偏好复古'})
    expect(corrected).toMatchObject({original_text:'极简风格',origin:'inferred',status:'active',source_payload:{answers:{E1:['极简']},originalPreferenceSignals:{positiveTerms:['minimal']}}})
    expect(corrected.source_payload).not.toHaveProperty('preferenceSignals')
    const replay=await manage('propose',{text:'极简风格',domain:'other',origin:'inferred',sourceKind:'assessment',
      sourcePayload:{assessmentId:'a',answers:{E1:['极简']},preferenceSignals:{positiveTerms:['minimal']}}})
    expect(replay.id).toBe(corrected.id);expect(replay.text).toBe('现在更偏好复古')
    const snapshot=await version()
    expect(snapshot.memories[0].sourcePayload).not.toHaveProperty('answers')
  })
  it('keeps confirmation and version unchanged when the revision conflicts',async()=>{
    const proposal=await manage('propose',{text:'复古',domain:'other',origin:'user',sourceKind:'chat'})
    await expect(manage('confirm',{id:proposal.id,revision:99})).rejects.toMatchObject({code:'40001'})
    expect((await version()).version).toBe(0)
    expect((await version()).memories).toHaveLength(0)
  })
  it('can cascade account deletion without failing the version trigger',async()=>{
    await manage('manual',{text:'Account B',domain:'other'},B)
    await db.query('delete from public.organization_members where user_id=$1',[B])
    await db.query('delete from auth.users where id=$1',[B])
    expect((await db.query('select * from public.consumer_context_versions where user_id=$1',[B])).rows).toHaveLength(0)
  })
})
