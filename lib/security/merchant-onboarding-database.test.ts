import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {beforeAll,afterAll,it,expect} from 'vitest'
let db:PGlite
const user='10000000-0000-4000-8000-000000000001'
beforeAll(async()=>{
 db=await PGlite.create();await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.organizations(id uuid primary key default gen_random_uuid(),name text,slug text unique,owner_user_id uuid);
 create table public.organization_members(id uuid primary key default gen_random_uuid(),organization_id uuid,user_id uuid,role text,status text,unique(organization_id,user_id));
 create table public.stores(id uuid primary key default gen_random_uuid(),organization_id uuid,name text,slug text,currency text,unique(organization_id,slug));
 create table public.store_settings(id uuid primary key default gen_random_uuid(),store_id uuid unique);
 create table public.sales_channels(id uuid primary key default gen_random_uuid(),organization_id uuid,code text,name text,channel_type text,status text,unique(organization_id,code));
 `)
 await db.exec(await readFile('supabase/migrations/20261013012438_create_organization_and_store_rpc.sql','utf8'))
},30000)
afterAll(async()=>db?.close())
const run=()=>db.query('select * from public.create_organization_and_store($1,$2,$3,$4,$5)',['Test Merchant','merchant-test','Test Store','merchant-test','CNY'])
it('reproduces the ambiguous column error and fixes all conflict targets',async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user])
 await expect(run()).rejects.toMatchObject({code:'42702'})
 await db.exec(await readFile('supabase/migrations/20261116103835_fix_merchant_onboarding_conflict.sql','utf8'))
 const result=await run();expect(result.rows[0]).toMatchObject({organization_id:expect.any(String),store_id:expect.any(String)})
 expect((await db.query('select role,status from public.organization_members')).rows).toEqual([{role:'owner',status:'active'}])
 expect((await db.query('select code from public.sales_channels')).rows).toEqual([{code:'storefront'}])
})
it('repeated onboarding creates no duplicate store or channel',async()=>{
 const first=await run(),second=await run();expect(first.rows).toEqual(second.rows)
 for(const table of ['organizations','stores','organization_members','store_settings','sales_channels'])expect((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n).toBe(1)
})
it('rejects a different account taking an existing organization slug',async()=>{
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",['10000000-0000-4000-8000-000000000002'])
 await expect(run()).rejects.toMatchObject({code:'23505'})
})
it('rejects unauthenticated onboarding',async()=>{
 await db.query("select set_config('request.jwt.claim.sub','',false)")
 await expect(run()).rejects.toMatchObject({code:'28000'})
})
