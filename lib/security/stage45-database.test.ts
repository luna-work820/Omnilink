import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest'

const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002'
const session='60000000-0000-4000-8000-000000000001',guest='a'.repeat(64)
const actor={userId:A,guestHash:null,sessionId:session}
let db:PGlite
async function role<T>(name:'anon'|'authenticated'|'service_role',user:string|null,action:()=>Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);await db.exec(`set role ${name}`)
  try{return await action()}finally{await db.exec('reset role')}
}
async function rpc(name:string,args:unknown[]) {
  return role('service_role',null,async()=>{
    const params=args.map((_,i)=>`$${i+1}`).join(',')
    return (await db.query<{value:Record<string,any>}>(`select public.${name}(${params}) as value`,args.map((a)=>typeof a==='object'&&!Array.isArray(a)?JSON.stringify(a):a))).rows[0].value
  })
}
const req=(action:string,input:Record<string,unknown>,owner=actor)=>rpc('manage_consumer_request',[action,owner,input])
const task=(action:string,input:Record<string,unknown>,owner=actor)=>rpc('manage_consumer_execution',[action,owner,input])
async function source(owner:Record<string,unknown>,t:Record<string,any>,title='沙发资料') {
  return rpc('save_consumer_external_source',[owner,{url:'https://example.com/article',urlHash:'b'.repeat(64),title,excerpt:'来自用户明确提供网址的资料内容。',contentHash:title,
    taskId:t.id,lease:t.lease}])
}
beforeAll(async()=>{
  db=await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql','utf8'))
  const migrations=['20261022015120_creator_content_posts','20261022015412_creator_posts_store_scope','20261022052325_creator_content_blocks',
    '20261022074619_creator_content_videos','20261024082331_eva_conversation_memory','20261024082638_eva_memory_supports',
    '20261108150902_rename_consumer_ai_assistant_objects','20261111020201_secure_creator_draft_reads','20261111020342_consumer_memory_confirmation']
  for(const name of migrations)await db.exec(await readFile(`supabase/migrations/${name}.sql`,'utf8'))
  await db.exec(await readFile('supabase/tests/fixtures/stage23_catalog.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20261111030610_consumer_discovery_personal_context.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20261113010000_consumer_execution_information.sql','utf8'))
},30_000)
beforeEach(async()=>{await db.exec('truncate public.consumer_requests,public.consumer_execution_tasks,public.consumer_external_sources,public."consumer_AI assistant_messages",public.creator_posts')})
afterAll(async()=>{await db?.close()})

describe('request ledger on PostgreSQL',()=>{
  it('reserves once, rejects changed payloads and persists one assistant reply atomically',async()=>{
    const first=await req('begin',{requestId:'one',inputHash:'a'.repeat(64)})
    expect(first.created).toBe(true)
    expect(await req('begin',{requestId:'one',inputHash:'a'.repeat(64)})).toMatchObject({created:false,status:'running',token:first.token})
    await expect(req('begin',{requestId:'one',inputHash:'b'.repeat(64)})).rejects.toMatchObject({code:'22000'})
    const result={text:'唯一回复',blocks:[{type:'chat_message',id:'r',version:1,data:{text:'唯一回复'}}]}
    await req('finish',{requestId:'one',token:first.token,status:'completed',httpStatus:200,result})
    expect(await req('begin',{requestId:'one',inputHash:'a'.repeat(64)})).toMatchObject({created:false,status:'completed',result})
    expect((await db.query('select id from public."consumer_AI assistant_messages"')).rows).toEqual([{id:'reply_one'}])
    await expect(req('finish',{requestId:'one',token:first.token,status:'completed',httpStatus:200,result})).rejects.toMatchObject({code:'40001'})
  })
  it('never transfers a request result to another account, guest or session',async()=>{
    await req('begin',{requestId:'one',inputHash:'a'.repeat(64)})
    for(const other of [{userId:B,guestHash:null,sessionId:session},{userId:null,guestHash:guest,sessionId:session},{...actor,sessionId:crypto.randomUUID()}])
      await expect(rpc('manage_consumer_request',['get',other,{requestId:'one'}])).rejects.toMatchObject({code:'P0002'})
  })
})
describe('durable task fencing on PostgreSQL',()=>{
  it('resumes four steps without consuming a retry per continuation',async()=>{
    const created=await task('create',{requestId:'task-one',input:{productIds:[],urls:['https://example.com']}})
    expect((await task('create',{requestId:'task-one',input:{productIds:[],urls:['https://example.com']}})).id).toBe(created.id)
    for(const step of ['context','products','sources','comparison']) {
      const claim=await task('claim',{id:created.id});expect(claim).toMatchObject({claimed:true,attempt:1})
      const written=await task('checkpoint',{id:created.id,lease:claim.lease,step,output:{data:step}})
      expect(written.checkpoints[step]).toEqual({data:step})
      await task('pause',{id:created.id,lease:claim.lease})
    }
    const claim=await task('claim',{id:created.id})
    expect(await task('complete',{id:created.id,lease:claim.lease,result:{columns:[]}})).toMatchObject({status:'completed',attempt:1})
  })
  it('rejects concurrent claims and stale writes after lease takeover or cancellation',async()=>{
    const created=await task('create',{requestId:'fence',input:{urls:['https://example.com']}})
    const first=await task('claim',{id:created.id})
    expect(await task('claim',{id:created.id})).toMatchObject({claimed:false,lease:first.lease})
    await db.query("update public.consumer_execution_tasks set lease_until=now()-interval '1 second' where id=$1",[created.id])
    const next=await task('claim',{id:created.id});expect(next.attempt).toBe(2);expect(next.lease).not.toBe(first.lease)
    await expect(task('checkpoint',{id:created.id,lease:first.lease,step:'context',output:{}})).rejects.toMatchObject({code:'40001'})
    await task('cancel',{id:created.id})
    await expect(task('complete',{id:created.id,lease:next.lease,result:{}})).rejects.toMatchObject({code:'40001'})
    expect(await task('get',{id:created.id})).toMatchObject({status:'cancelled'})
  })
  it('keeps completed checkpoints across explicit retries and enforces the attempt ceiling',async()=>{
    const created=await task('create',{requestId:'retry',input:{urls:['https://example.com']}})
    let claim=await task('claim',{id:created.id})
    await task('checkpoint',{id:created.id,lease:claim.lease,step:'context',output:{data:{version:1}}})
    for(let attempt=1;attempt<=3;attempt++) {
      await task('fail',{id:created.id,lease:claim.lease,errorCode:'SOURCE_UNAVAILABLE'})
      if(attempt<3){await task('retry',{id:created.id});claim=await task('claim',{id:created.id});expect(claim.checkpoints).toHaveProperty('context')}
    }
    await expect(task('retry',{id:created.id})).rejects.toMatchObject({code:'40001'})
  })
  it('fences source writes and isolates imported sources by session and identity',async()=>{
    const created=await task('create',{requestId:'source',input:{urls:['https://example.com']}}),claim=await task('claim',{id:created.id})
    const saved=await source(actor,claim)
    const result=await rpc('search_consumer_information',[actor,'沙发',['source'],20])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({id:saved.id,title:'沙发资料'})
    expect(await rpc('search_consumer_information',[{...actor,userId:B},'沙发',['source'],20])).toEqual([])
    expect(await rpc('search_consumer_information',[{...actor,sessionId:crypto.randomUUID()},'沙发',['source'],20])).toEqual([])
    await task('cancel',{id:created.id})
    await expect(source(actor,claim,'取消后的写入')).rejects.toMatchObject({code:'40001'})
    expect((await db.query('select title from public.consumer_external_sources')).rows).toEqual([{title:'沙发资料'}])
  })
})
describe('information projection and client permissions',()=>{
  it('includes published content while excluding drafts and pending modifications',async()=>{
    await db.query(`insert into public.creator_posts(organization_id,store_id,author_id,kind,title,status,body,draft_version)
      values ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',$1,'note','沙发选购','published','公开内容','{"title":"秘密修改"}'),
      ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',$1,'note','沙发草稿','draft','秘密内容',null)`,[A])
    const result=await rpc('search_consumer_information',[actor,'沙发',['content'],20])
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({title:'沙发选购',excerpt:'公开内容'})
    expect(JSON.stringify(result)).not.toContain('秘密')
  })
  it('updates the physical index on authorized publishing, withdraws stale documents and uses a GIN search index',async()=>{
    await role('authenticated',A,()=>db.query(`insert into public.creator_posts(organization_id,store_id,author_id,kind,title,status,body)
      values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',$1,'note','沙发 复古','published','公开资料')`,[A]))
    expect(await rpc('search_consumer_information',[actor,'沙发 复古',['content'],20])).toHaveLength(1)
    await db.exec("update public.creator_posts set status='draft'")
    expect(await rpc('search_consumer_information',[actor,'沙发',['content'],20])).toEqual([])
    const index=(await db.query<{indexdef:string}>("select indexdef from pg_indexes where indexname='consumer_information_documents_search_idx'")).rows[0]
    expect(index.indexdef).toContain('USING gin (search_vector)')
  })
  it.each(['anon','authenticated'] as const)('denies %s direct tables and service-only RPCs',async(name)=>{
    await role(name,name==='anon'?null:A,async()=>{
      for(const table of ['consumer_requests','consumer_execution_tasks','consumer_external_sources','consumer_public_information','consumer_information_documents'])
        await expect(db.query(`select * from public.${table}`)).rejects.toMatchObject({code:'42501'})
      await expect(db.query('select public.manage_consumer_request($1,$2,$3)',['begin',JSON.stringify(actor),'{}'])).rejects.toMatchObject({code:'42501'})
    })
  })
})
