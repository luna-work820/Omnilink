begin;
drop policy creator_assets_read on public.creator_post_assets;
create policy creator_assets_public_read on public.creator_post_assets for select to anon,authenticated using (
  not is_draft and exists (select 1 from public.creator_posts p where p.id=post_id and p.status='published' and p.visibility='public')
);
create policy creator_assets_member_read on public.creator_post_assets for select to authenticated using (
  exists (select 1 from public.creator_posts p where p.id=post_id and private.is_org_member(p.organization_id,array['owner','admin','editor']))
);
commit;
