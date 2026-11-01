alter table public.creator_posts
  add constraint creator_posts_store_organization_fkey
  foreign key (store_id, organization_id)
  references public.stores(id, organization_id)
  on delete cascade;
