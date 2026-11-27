import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const first = '10000000-0000-4000-8000-000000000001'
const second = '10000000-0000-4000-8000-000000000002'
let db: PGlite

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema private;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create table public.profiles (
      id uuid primary key references auth.users(id), email text not null, display_name text,
      onboarding_status text not null default 'pending', updated_at timestamptz not null default now()
    );
    alter table public.profiles enable row level security;
    grant select, update on public.profiles to anon, authenticated;
    create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
    create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
    create function private.handle_new_user_profile() returns trigger language plpgsql security definer set search_path = '' as $$
    begin
      insert into public.profiles(id, email, display_name)
      values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));
      return new;
    end;
    $$;
    create trigger on_auth_user_created_profile after insert on auth.users for each row execute function private.handle_new_user_profile();
  `)
  await db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3),($4,$5,$6)', [
    first, 'first@example.com', JSON.stringify({ full_name: 'Alice' }),
    second, 'second@example.com', JSON.stringify({ full_name: '小林' }),
  ])
  await db.exec(await readFile('supabase/migrations/20261126055504_unique_profile_username.sql', 'utf8'))
}, 30000)

afterAll(async () => { await db?.close() })

describe('unique registration usernames', () => {
  it('reports username availability without exposing profile records', async () => {
    await db.exec('set role anon')
    try {
      expect((await db.query<{ taken: boolean }>("select public.signup_username_taken(' ALICE ') as taken")).rows[0].taken).toBe(true)
      expect((await db.query<{ taken: boolean }>("select public.signup_username_taken('新用户') as taken")).rows[0].taken).toBe(false)
      expect((await db.query('select * from public.profiles')).rows).toEqual([])
    } finally { await db.exec('reset role') }
  })

  it('rejects duplicate or missing usernames when an account is created', async () => {
    await expect(db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [
      '10000000-0000-4000-8000-000000000003', 'third@example.com', JSON.stringify({ full_name: ' alice ' }),
    ])).rejects.toMatchObject({ code: '23505' })
    await expect(db.query('insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)', [
      '10000000-0000-4000-8000-000000000004', 'fourth@example.com', JSON.stringify({ full_name: '  ' }),
    ])).rejects.toMatchObject({ code: '23514' })
    expect((await db.query('select id from auth.users where id in ($1,$2)', [
      '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004',
    ])).rows).toEqual([])
  })

  it('allows only one account to claim a username across concurrent attempts', async () => {
    const attempts = await Promise.allSettled(['5', '6'].map((suffix) => db.query(
      'insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3)',
      [`10000000-0000-4000-8000-00000000000${suffix}`, `${suffix}@example.com`, JSON.stringify({ full_name: '并发用户' })],
    )))
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1)
    const rejected = attempts.find((attempt) => attempt.status === 'rejected')
    expect(rejected).toMatchObject({ status: 'rejected', reason: { code: '23505' } })
  })

  it('keeps profile usernames in sync and rejects conflicting changes', async () => {
    await db.query("update auth.users set raw_user_meta_data = $1 where id = $2", [JSON.stringify({ full_name: '新的名字' }), first])
    expect((await db.query<{ display_name: string }>('select display_name from public.profiles where id=$1', [first])).rows[0].display_name).toBe('新的名字')
    await expect(db.query('update auth.users set raw_user_meta_data = $1 where id = $2', [JSON.stringify({ full_name: ' 新的名字 ' }), second]))
      .rejects.toMatchObject({ code: '23505' })
  })

  it('prevents direct profile edits from bypassing the account username', async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [first])
    await db.exec('set role authenticated')
    try {
      await expect(db.query('update public.profiles set display_name=$1 where id=$2', ['另一个名字', first]))
        .rejects.toMatchObject({ code: '42501' })
      await db.query("update public.profiles set onboarding_status='completed' where id=$1", [first])
    } finally { await db.exec('reset role') }
  })
})
