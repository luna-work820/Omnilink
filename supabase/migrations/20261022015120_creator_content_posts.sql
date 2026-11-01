create table public.creator_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('collection', 'note')),
  title text not null default '',
  cover_url text not null default '',
  body text not null default '',
  product_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_posts_store_updated_idx on public.creator_posts(store_id, updated_at desc);
create index creator_posts_public_idx on public.creator_posts(published_at desc) where status = 'published';

alter table public.creator_posts enable row level security;
grant select on public.creator_posts to anon;
grant select, insert, update, delete on public.creator_posts to authenticated;

create policy creator_posts_public_read on public.creator_posts
  for select to anon, authenticated using (status = 'published');
create policy creator_posts_member_read on public.creator_posts
  for select to authenticated using (private.is_org_member(organization_id));
create policy creator_posts_editor_insert on public.creator_posts
  for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy creator_posts_editor_update on public.creator_posts
  for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy creator_posts_editor_delete on public.creator_posts
  for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));
