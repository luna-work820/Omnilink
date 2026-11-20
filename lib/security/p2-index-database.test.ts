import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const bge = {
  id: 'bge-small-zh-v1.5-512-v1',
  provider: 'local-bge',
  model: 'BAAI/bge-small-zh-v1.5-onnx-quantized',
  revision: 'v1.5-onnx-quantized',
  dimensions: 512,
  preprocessing: 'product-facts-v1',
  indexVersion: 1,
}
const qwen = {
  id: 'qwen-text-embedding-v4-1024-v1',
  provider: 'qwen',
  model: 'text-embedding-v4',
  revision: 'provider-alias:text-embedding-v4',
  dimensions: 1024,
  preprocessing: 'product-facts-v1',
  indexVersion: 1,
}
const tokenA = '90000000-0000-4000-8000-000000000001'
const tokenB = '90000000-0000-4000-8000-000000000002'
const hashA = 'a'.repeat(64)
const hashB = 'b'.repeat(64)
type Profile = typeof qwen
type VectorRow = { key: string; hash: string; embedding: string }
let db: PGlite

// PGlite has no pgvector here. Only its vector type and scalar math are shimmed;
// the two HNSW indexes are omitted. These tests verify migration control logic,
// permissions and filtering, not pgvector casts, ANN behavior or performance.
const vectorShim = `
  create schema extensions;
  grant usage on schema extensions to anon, authenticated, service_role;
  create domain extensions.vector as real[];
  create function extensions.vector_dims(extensions.vector) returns integer
    language sql immutable strict as $$ select cardinality($1) $$;
  create function extensions.vector_norm(extensions.vector) returns double precision
    language sql immutable strict as $$
      select sqrt(sum(component::double precision * component::double precision))
      from unnest($1) as components(component)
    $$;
  create function extensions.vector_cosine_distance(extensions.vector, extensions.vector)
    returns double precision language sql immutable strict as $$
      select 1 - sum(a::double precision * b::double precision)
        / (extensions.vector_norm($1) * extensions.vector_norm($2))
      from unnest($1::real[], $2::real[]) as components(a, b)
    $$;
  create operator extensions.<=> (
    leftarg = extensions.vector, rightarg = extensions.vector,
    function = extensions.vector_cosine_distance
  );
`

function vector(dimensions = 1024, axis = 0) {
  return `{${Array.from({ length: dimensions }, (_, i) => i === axis ? 1 : 0).join(',')}}`
}
async function scalar<T>(sql: string, params: unknown[] = []) {
  return (await db.query<{ value: T }>(sql, params)).rows[0].value
}
async function asRole<T>(role: 'anon' | 'authenticated' | 'service_role', action: () => Promise<T>) {
  await db.exec(`set role ${role}`)
  try { return await action() } finally { await db.exec('reset role') }
}
function claim(profile: Profile = qwen, token: string | null = tokenA) {
  return scalar<boolean>('select public.claim_consumer_embedding_profile($1::jsonb, $2::uuid) as value', [JSON.stringify(profile), token])
}
function write(rows: VectorRow[], profile: Profile = qwen, token: string | null = tokenA) {
  return db.query('select public.write_consumer_catalog_vectors($1::jsonb, $2::uuid, $3::jsonb)', [JSON.stringify(profile), token, JSON.stringify(rows)])
}
function finish(profile: Profile = qwen, token: string | null = tokenA, documents: { key: string; hash: string }[] = [], error: string | null = null) {
  return scalar<boolean>('select public.finish_consumer_embedding_profile($1::text, $2::uuid, $3::jsonb, $4::text) as value', [profile.id, token, JSON.stringify(documents), error])
}
function match(documents: { key: string; hash: string }[], profile: Profile = qwen, query = vector(profile.dimensions), limit = 1000) {
  return db.query<{ product_key: string; similarity: number }>('select * from public.match_consumer_catalog_vectors($1::jsonb, $2::extensions.vector, $3::jsonb, $4::integer)', [JSON.stringify(profile), query, JSON.stringify(documents), limit])
}
async function profileState(profile: Profile = qwen) {
  return (await db.query<{ status: string; lease: string | null; has_lock: boolean; indexed: boolean; last_error: string | null }>(
    `select status, lease, locked_until is not null as has_lock, indexed_at is not null as indexed, last_error
      from public.consumer_embedding_profiles where id=$1`, [profile.id])).rows[0]
}
async function ready(profile: Profile, rows: VectorRow[]) {
  expect(await claim(profile)).toBe(true)
  await write(rows, profile)
  expect(await finish(profile, tokenA, rows.map(({ key, hash }) => ({ key, hash })))).toBe(true)
}

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(await readFile('supabase/tests/fixtures/stage01_baseline.sql', 'utf8'))
  await db.exec(vectorShim)
  const migration = await readFile('supabase/migrations/20261114073614_consumer_versioned_embeddings.sql', 'utf8')
  const hnsw = /create index consumer_vectors_(?:bge|qwen)_v1 on public\.consumer_catalog_vectors\s+using hnsw[\s\S]*?;/g
  expect(migration.match(hnsw)).toHaveLength(2)
  await db.exec(migration.replace(hnsw, ''))
  const v2=await readFile('supabase/migrations/20261114140108_consumer_search_profiles_v2.sql','utf8')
  const v2Indexes=/create index consumer_vectors_(?:bge|qwen)_v2 on public\.consumer_catalog_vectors\s+using hnsw[\s\S]*?;/g
  expect(v2.match(v2Indexes)).toHaveLength(2)
  await db.exec(v2.replace(v2Indexes,''))
}, 30000)

beforeEach(async () => {
  await db.exec(`truncate public.consumer_catalog_vectors;
    update public.consumer_embedding_profiles set status='building', lease=null,
      locked_until=null, last_error=null, indexed_at=null;`)
})
afterAll(async () => { await db?.close() })

describe('versioned embedding database permissions', () => {
  it('enables RLS on both public index tables', async () => {
    expect((await db.query(`select relname, relrowsecurity from pg_class
      where oid in ('public.consumer_embedding_profiles'::regclass, 'public.consumer_catalog_vectors'::regclass)
      order by relname`)).rows).toEqual([
      { relname: 'consumer_catalog_vectors', relrowsecurity: true },
      { relname: 'consumer_embedding_profiles', relrowsecurity: true },
    ])
  })

  it.each(['anon', 'authenticated'] as const)('denies %s direct table access and every index RPC', async (role) => {
    await asRole(role, async () => {
      for (const table of ['consumer_embedding_profiles', 'consumer_catalog_vectors']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) {
          expect(await scalar<boolean>('select has_table_privilege(current_user, $1, $2) as value', [`public.${table}`, privilege])).toBe(false)
        }
        await expect(db.query(`select * from public.${table}`)).rejects.toMatchObject({ code: '42501' })
      }
      await expect(claim()).rejects.toMatchObject({ code: '42501' })
      await expect(write([])).rejects.toMatchObject({ code: '42501' })
      await expect(finish()).rejects.toMatchObject({ code: '42501' })
      await expect(match([])).rejects.toMatchObject({ code: '42501' })
    })
  })

  it('lets the service role read profiles and update lease state, while protecting profile identity', async () => {
    await asRole('service_role', async () => {
      expect(await scalar<number>('select count(*)::integer as value from public.consumer_embedding_profiles')).toBe(4)
      for (const column of ['id', 'profile']) {
        expect(await scalar<boolean>('select has_column_privilege(current_user, $1, $2, $3) as value', ['public.consumer_embedding_profiles', column, 'UPDATE'])).toBe(false)
      }
      for (const column of ['status', 'lease', 'locked_until', 'last_error', 'indexed_at']) {
        expect(await scalar<boolean>('select has_column_privilege(current_user, $1, $2, $3) as value', ['public.consumer_embedding_profiles', column, 'UPDATE'])).toBe(true)
      }
      await expect(db.query('update public.consumer_embedding_profiles set profile=$1::jsonb where id=$2', [JSON.stringify({ ...qwen, model: 'other-model' }), qwen.id])).rejects.toMatchObject({ code: '42501' })
      await expect(db.query('update public.consumer_embedding_profiles set id=id where id=$1', [qwen.id])).rejects.toMatchObject({ code: '42501' })
      await expect(db.query('insert into public.consumer_embedding_profiles(id,profile) values ($1,$2::jsonb)', ['other', JSON.stringify({ ...qwen, id: 'other' })])).rejects.toMatchObject({ code: '42501' })
      await expect(db.query('delete from public.consumer_embedding_profiles where id=$1', [qwen.id])).rejects.toMatchObject({ code: '42501' })
      expect(await claim()).toBe(true)
      await write([{ key: 'service-write', hash: hashA, embedding: vector() }])
      expect(await scalar<number>('select count(*)::integer as value from public.consumer_catalog_vectors')).toBe(1)
      await expect(db.query('delete from public.consumer_catalog_vectors')).rejects.toMatchObject({ code: '42501' })
    })
  })
})

describe('embedding profile claims and leases', () => {
  it.each(['id', 'provider', 'model', 'revision', 'dimensions', 'preprocessing', 'indexVersion', 'extra'])('rejects a claim with different %s metadata', async (field) => {
    const changed = { ...qwen, [field]: field === 'dimensions' ? 512 : 'different' }
    await asRole('service_role', async () => {
      await expect(claim(changed)).rejects.toMatchObject({ code: '22023', message: 'INDEX_PROFILE_MISMATCH' })
    })
    expect(await profileState()).toMatchObject({ lease: null, has_lock: false })
  })

  it('rejects a null claim token and refuses writes or completion without a lease', async () => {
    await asRole('service_role', async () => {
      await expect(claim(qwen, null)).rejects.toMatchObject({ code: '22023', message: 'INDEX_PROFILE_MISMATCH' })
      await expect(write([])).rejects.toMatchObject({ code: '40001', message: 'INDEX_LEASE_LOST' })
      expect(await finish()).toBe(false)
      expect(await claim()).toBe(true)
      await expect(write([], qwen, null)).rejects.toMatchObject({ code: '40001', message: 'INDEX_LEASE_LOST' })
      expect(await finish(qwen, null)).toBe(false)
    })
    expect(await profileState()).toMatchObject({ status: 'building', lease: tokenA, has_lock: true })
  })

  it.each(['null lease', 'null deadline', 'expired deadline'])('refuses writes and completion with a %s', async (state) => {
    await asRole('service_role', async () => { expect(await claim()).toBe(true) })
    const assignment = state === 'null lease' ? 'lease=null' : state === 'null deadline' ? 'locked_until=null' : "locked_until=now()-interval '1 second'"
    await db.query(`update public.consumer_embedding_profiles set ${assignment} where id=$1`, [qwen.id])
    const before = await profileState()
    await asRole('service_role', async () => {
      await expect(write([{ key: 'invalid-lease', hash: hashA, embedding: vector() }])).rejects.toMatchObject({ code: '40001', message: 'INDEX_LEASE_LOST' })
      expect(await finish()).toBe(false)
    })
    expect(await profileState()).toEqual(before)
    expect(await scalar<number>('select count(*)::integer as value from public.consumer_catalog_vectors')).toBe(0)
  })

  it('grants only one of two competing claims while its lease is active', async () => {
    await asRole('service_role', async () => {
      // PGlite queues these attempts on one session. This checks lease exclusion,
      // but cannot prove FOR UPDATE behavior across independent connections.
      const claims = await Promise.all([claim(qwen, tokenA), claim(qwen, tokenB)])
      expect(claims.filter(Boolean)).toHaveLength(1)
      const winner = claims[0] ? tokenA : tokenB
      expect(await profileState()).toMatchObject({ status: 'building', lease: winner, has_lock: true })
      expect(await claim(qwen, winner)).toBe(false)
    })
  })

  it('lets a new worker take an expired lease and fences the old worker from writes and completion', async () => {
    await asRole('service_role', async () => { expect(await claim()).toBe(true) })
    await db.query("update public.consumer_embedding_profiles set locked_until=now()-interval '1 second' where id=$1", [qwen.id])
    await asRole('service_role', async () => {
      expect(await claim(qwen, tokenB)).toBe(true)
      await expect(write([{ key: 'old-worker', hash: hashA, embedding: vector() }])).rejects.toMatchObject({ code: '40001', message: 'INDEX_LEASE_LOST' })
      expect(await finish(qwen, tokenA, [], 'stale failure')).toBe(false)
      expect(await profileState()).toMatchObject({ status: 'building', lease: tokenB, has_lock: true, last_error: null })
      const rows = [{ key: 'new-worker', hash: hashB, embedding: vector() }]
      await write(rows, qwen, tokenB)
      expect(await finish(qwen, tokenB, rows)).toBe(true)
      expect(await finish(qwen, tokenA, [], 'late stale failure')).toBe(false)
      await expect(write([], qwen, tokenA)).rejects.toMatchObject({ code: '40001', message: 'INDEX_LEASE_LOST' })
    })
    expect(await profileState()).toMatchObject({ status: 'ready', lease: null, has_lock: false, indexed: true, last_error: null })
    expect((await db.query('select product_key,content_hash from public.consumer_catalog_vectors')).rows).toEqual([{ product_key: 'new-worker', content_hash: hashB }])
  })
})

describe('versioned vector writes, completion and matching', () => {
  it('keeps v1 and v2 profiles and vectors isolated, with new profiles initially unavailable for queries',async()=>{
    const v2={...qwen,id:'qwen-text-embedding-v4-1024-v2',preprocessing:'product-facts-bilingual-v2',indexVersion:2}
    await asRole('service_role',async()=>{
      await expect(match([],v2)).rejects.toMatchObject({message:'INDEX_PROFILE_MISMATCH'})
      await ready(qwen,[{key:'same-product',hash:hashA,embedding:vector()}])
      await ready(v2,[{key:'same-product',hash:hashB,embedding:vector(1024,1)}])
      expect((await match([{key:'same-product',hash:hashA}],qwen)).rows).toEqual([{product_key:'same-product',similarity:1}])
      expect((await match([{key:'same-product',hash:hashB}],v2)).rows).toEqual([{product_key:'same-product',similarity:0}])
      expect((await match([{key:'same-product',hash:hashA}],v2)).rows).toEqual([])
    })
  })
  it('validates dimensions and norm and rolls back an invalid batch before accepting 1024-dimensional vectors', async () => {
    await asRole('service_role', async () => {
      expect(await claim()).toBe(true)
      for (const invalid of [vector(512), `{${Array(1024).fill(0).join(',')}}`]) {
        await expect(write([
          { key: 'valid-before-invalid', hash: hashA, embedding: vector() },
          { key: 'invalid', hash: hashA, embedding: invalid },
        ])).rejects.toMatchObject({ code: '22023', message: 'EMBEDDING_DIMENSION_MISMATCH' })
        expect(await scalar<number>('select count(*)::integer as value from public.consumer_catalog_vectors')).toBe(0)
      }
      await expect(write(Array.from({ length: 25 }, (_, i) => ({ key: `batch-${i}`, hash: hashA, embedding: vector() })))).rejects.toMatchObject({ message: 'INDEX_BATCH_INVALID' })
      await write([{ key: 'valid', hash: hashA, embedding: vector() }])
      expect(await finish(qwen, tokenA, [{ key: 'valid', hash: hashA }])).toBe(true)
    })
  })

  it('requires every completed document to have a vector with its current content hash', async () => {
    await asRole('service_role', async () => {
      expect(await claim()).toBe(true)
      await write([{ key: 'changed', hash: hashA, embedding: vector() }])
      const documents = [{ key: 'changed', hash: hashB }, { key: 'missing', hash: hashA }]
      await expect(finish(qwen, tokenA, documents)).rejects.toMatchObject({ message: 'INDEX_INCOMPLETE' })
      expect(await profileState()).toMatchObject({ status: 'building', lease: tokenA, has_lock: true, indexed: false })
      await write(documents.map((document) => ({ ...document, embedding: vector() })))
      expect(await finish(qwen, tokenA, documents)).toBe(true)
    })
    expect(await profileState()).toMatchObject({ status: 'ready', lease: null, has_lock: false, indexed: true })
  })

  it('records a failed build, releases the lease and preserves existing vectors', async () => {
    await asRole('service_role', async () => {
      expect(await claim()).toBe(true)
      await write([{ key: 'preserved', hash: hashA, embedding: vector() }])
      expect(await finish(qwen, tokenA, [], 'provider unavailable')).toBe(true)
      expect(await profileState()).toMatchObject({ status: 'failed', lease: null, has_lock: false, indexed: false, last_error: 'provider unavailable' })
      expect(await scalar<number>('select count(*)::integer as value from public.consumer_catalog_vectors')).toBe(1)
      await expect(match([{ key: 'preserved', hash: hashA }])).rejects.toMatchObject({ message: 'INDEX_PROFILE_MISMATCH' })
    })
  })

  it('matches only the ready requested profile and current requested content hashes', async () => {
    await asRole('service_role', async () => {
      await ready(bge, [{ key: 'shared', hash: hashA, embedding: vector(512) }])
      await ready(qwen, [
        { key: 'shared', hash: hashA, embedding: vector(1024, 1) },
        { key: 'fresh', hash: hashB, embedding: vector() },
        { key: 'stale', hash: hashA, embedding: vector() },
        { key: 'unrequested', hash: hashA, embedding: vector() },
      ])
      const documents = [{ key: 'shared', hash: hashA }, { key: 'fresh', hash: hashB }, { key: 'stale', hash: hashB }]
      expect((await match(documents)).rows).toEqual([
        { product_key: 'fresh', similarity: 1 },
        { product_key: 'shared', similarity: 0 },
      ])
      expect((await match(documents, qwen, vector(), 1)).rows).toEqual([{ product_key: 'fresh', similarity: 1 }])
      expect((await match([{ key: 'shared', hash: hashA }], bge)).rows).toEqual([{ product_key: 'shared', similarity: 1 }])
      await expect(match(documents, { ...qwen, revision: 'different' })).rejects.toMatchObject({ message: 'INDEX_PROFILE_MISMATCH' })
      await expect(match(documents, qwen, vector(512))).rejects.toMatchObject({ message: 'EMBEDDING_DIMENSION_MISMATCH' })
    })
  })
})
