import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll,beforeAll,describe,expect,it } from 'vitest'
let db:PGlite
const user='10000000-0000-4000-8000-000000000001',session='60000000-0000-4000-8000-000000000001'
const spec={query:'earrings',termGroups:[['earrings','耳环']],retrieval:{mode:'semantic',profile:'qwen-text-embedding-v4-1024-v1'}}
beforeAll(async()=>{
  db=await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql','utf8'))
  for(const name of ['20261024082331_eva_conversation_memory','20261024082638_eva_memory_supports',
    '20261108150902_rename_consumer_ai_assistant_objects','20261111020342_consumer_memory_confirmation'])
    await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'))
  await db.exec(await readFile('supabase/tests/fixtures/stage23_catalog.sql','utf8'))
  for(const name of ['20261111030610_consumer_discovery_personal_context','20261114073613_consumer_unified_execution'])
    await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'))
},30_000)
afterAll(async()=>db?.close())
async function run() {
  const id=crypto.randomUUID()
  await db.query('select public.create_consumer_discovery_run($1)',[JSON.stringify({id,user_id:user,guest_hash:null,session_id:session,spec,
    candidate_ids:[],context_version:0,expires_at:new Date(Date.now()+600_000).toISOString(),
    execution:{catalogVersion:'five-store-v1',candidateKeys:['external-cled-approved'],retrieval:{profile:spec.retrieval.profile}}})])
  return id
}
const read=(id:string,who:string|null=user,ownerSession=session,version=0)=>db.query<{result:{spec:typeof spec;execution:{candidateKeys:string[]}}}>(
  'select public.read_consumer_discovery_execution($1,$2,null,$3,$4) as result',[id,who,ownerSession,version])
describe('P1 search persistence and scoped context in PostgreSQL',()=>{
  it('keeps the chosen profile with the immutable candidate sequence',async()=>{
    const id=await run(),result=(await read(id)).rows[0].result
    expect(result.spec).toEqual(spec)
    expect(result.execution.candidateKeys).toEqual(['external-cled-approved'])
    expect((await read(id)).rows[0].result).toEqual(result)
  })
  it('rejects another account, guest, session, changed context and expired search',async()=>{
    const id=await run()
    await expect(read(id,crypto.randomUUID())).rejects.toMatchObject({code:'P0002'})
    await expect(read(id,null)).rejects.toMatchObject({code:'P0002'})
    await expect(read(id,user,crypto.randomUUID())).rejects.toMatchObject({code:'P0002'})
    await expect(read(id,user,session,1)).rejects.toMatchObject({code:'40001'})
    await db.query("update public.consumer_discovery_runs set expires_at=now()-interval '1 second' where id=$1",[id])
    await expect(read(id)).rejects.toMatchObject({message:'SEARCH_EXPIRED'})
  })
  it('does not expose execution references or memory RPCs to client roles',async()=>{
    const id=await run()
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`)
      try {
        await expect(read(id)).rejects.toMatchObject({code:'42501'})
        await expect(db.query('select public.get_consumer_task_context($1,$2)',[user,[]])).rejects.toMatchObject({code:'42501'})
      } finally {await db.exec('reset role')}
    }
  })
  it('can read only the context version and then a bounded relevant domain',async()=>{
    await db.exec('set role service_role')
    try {
      for(const domain of ['skin','clothing'])await db.query('select public.manage_consumer_memory($1,$2,$3)',[user,'manual',JSON.stringify({text:`Preference ${domain}`,domain})])
      const readContext=async(domains:string[])=>(await db.query<{value:{version:number;memories:{domain:string}[]}}>(
        'select public.get_consumer_task_context($1,$2) as value',[user,domains])).rows[0].value
      expect(await readContext([])).toEqual({version:2,memories:[]})
      expect(await readContext(['clothing'])).toMatchObject({version:2,memories:[{domain:'clothing'}]})
    } finally {await db.exec('reset role')}
  })
})
