begin;

-- Published rows contain unpublished draft_version data; RLS alone cannot hide it.
revoke all on public.creator_posts from public, anon, authenticated;
grant select (id, organization_id, store_id, author_id, kind, title, cover_url,
  body, product_ids, blocks, status, published_at, created_at, updated_at)
  on public.creator_posts to anon, authenticated;
grant insert, update, delete on public.creator_posts to authenticated;
grant usage on schema private to authenticated;

create or replace function private.creator_posts_for_editor(p_store_id uuid)
returns setof public.creator_posts
language sql stable security definer
set search_path = ''
as $$
  select p.* from public.creator_posts p
  where p.store_id = p_store_id
    and (select auth.uid()) is not null
    and private.is_org_member(p.organization_id, array['owner','admin','editor'])
  order by p.updated_at desc, p.id
  limit 100;
$$;
revoke all on function private.creator_posts_for_editor(uuid) from public, anon, authenticated;
grant execute on function private.creator_posts_for_editor(uuid) to authenticated;

create or replace function public.get_creator_posts_for_editor(p_store_id uuid)
returns setof public.creator_posts
language sql stable security invoker
set search_path = ''
as $$ select * from private.creator_posts_for_editor(p_store_id); $$;
revoke all on function public.get_creator_posts_for_editor(uuid) from public, anon, authenticated;
grant execute on function public.get_creator_posts_for_editor(uuid) to authenticated;

commit;
