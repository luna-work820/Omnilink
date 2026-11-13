begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-content-videos', 'creator-content-videos', false, 104857600, array['video/mp4','video/webm'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.normalize_creator_video_blocks(blocks jsonb)
returns jsonb language sql immutable security invoker
set search_path = ''
as $$
  select case when jsonb_typeof(blocks) = 'array' then
    coalesce((select jsonb_agg(case
      when block->>'type' = 'video' and block->>'url' ~* '^https://[^/]+/storage/v1/object/public/creator-content-videos/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm)$'
      then jsonb_set(block, '{url}', to_jsonb(regexp_replace(block->>'url', '^https://[^/]+/storage/v1/object/public/creator-content-videos/', '/api/creator-posts/media/')))
      else block end order by ordinal)
      from jsonb_array_elements(blocks) with ordinality as item(block, ordinal)), '[]'::jsonb)
    else blocks end;
$$;
revoke all on function private.normalize_creator_video_blocks(jsonb) from public, anon, authenticated;

update public.creator_posts set blocks = private.normalize_creator_video_blocks(blocks)
where blocks is distinct from private.normalize_creator_video_blocks(blocks);
update public.creator_posts set draft_version = jsonb_set(draft_version, '{blocks}', private.normalize_creator_video_blocks(draft_version->'blocks'))
where jsonb_typeof(draft_version->'blocks') = 'array'
  and draft_version->'blocks' is distinct from private.normalize_creator_video_blocks(draft_version->'blocks');

commit;
