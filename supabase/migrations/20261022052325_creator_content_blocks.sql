alter table public.creator_posts
  add column blocks jsonb not null default '[]'::jsonb,
  add column draft_version jsonb;

alter table public.creator_posts
  add constraint creator_posts_blocks_array check (jsonb_typeof(blocks) = 'array'),
  add constraint creator_posts_draft_version_object check (draft_version is null or jsonb_typeof(draft_version) = 'object');
