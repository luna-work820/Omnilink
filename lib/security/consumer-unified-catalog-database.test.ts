import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

let db: PGlite
const url = 'https://store.example/product'
const product = (id: string, name: string) => JSON.stringify({id, name, sourceUrl:url})
async function asRole<T>(role: 'anon' | 'authenticated' | 'service_role', action: () => Promise<T>) {
  await db.exec(`set role ${role}`)
  try { return await action() } finally { await db.exec('reset role') }
}
async function upsert(id: string, name: string, date: string, publish: boolean, source = 'firecrawl') {
  return db.query<{id:string}>('select public.upsert_consumer_catalog_product($1,$2::jsonb,$3,$4::timestamptz,$5) as id',
    [url, product(id,name), source, date, publish])
}

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql', 'utf8'))
  await db.exec('create table public.consumer_discovery_runs (execution jsonb)')
  await db.exec(await readFile('supabase/migrations/20261119023850_consumer_unified_catalog.sql', 'utf8'))
}, 30000)
beforeEach(async () => { await db.exec('truncate public.consumer_catalog_products') })
afterAll(async () => { await db?.close() })

describe('unified catalog permissions and source identity', () => {
  it.each(['anon','authenticated'] as const)('only exposes published product fields to %s', async (role) => {
    await asRole('service_role', async () => { await upsert('original','Draft','2026-11-19T10:00:00Z',false) })
    await asRole(role, async () => {
      expect((await db.query('select id,product,published from public.consumer_catalog_products')).rows).toEqual([])
      await expect(upsert('original','Unsafe','2026-11-19T11:00:00Z',true)).rejects.toMatchObject({code:'42501'})
      await expect(db.query('select source_type from public.consumer_catalog_products')).rejects.toMatchObject({code:'42501'})
    })
    await asRole('service_role', async () => { await upsert('new-id','Published','2026-11-19T11:00:00Z',true,'apify') })
    await asRole(role, async () => {
      expect((await db.query<{id:string;product:{name:string}}>('select id,product from public.consumer_catalog_products')).rows)
        .toMatchObject([{id:'original',product:{id:'original',name:'Published'}}])
    })
  })

  it('keeps one stable ID, ignores older captures and does not unpublish on refresh', async () => {
    await asRole('service_role', async () => {
      expect((await upsert('original','First','2026-11-19T10:00:00Z',true)).rows[0].id).toBe('original')
      expect((await upsert('other','Latest','2026-11-19T11:00:00Z',false,'apify')).rows[0].id).toBe('original')
      await upsert('stale','Old','2026-11-19T09:00:00Z',false)
      expect((await db.query('select id,product,source_type,published from public.consumer_catalog_products')).rows)
        .toMatchObject([{id:'original',product:{id:'original',name:'Latest'},source_type:'apify',published:true}])
    })
  })

  it('rejects a product whose source URL differs from the deduplication URL', async () => {
    await asRole('service_role', async () => {
      await expect(db.query('select public.upsert_consumer_catalog_product($1,$2::jsonb,$3,$4::timestamptz,$5)',
        [url,JSON.stringify({id:'x',sourceUrl:'https://other.example/item'}),'firecrawl','2026-11-19T10:00:00Z',true]))
        .rejects.toMatchObject({code:'22023'})
    })
  })
})
