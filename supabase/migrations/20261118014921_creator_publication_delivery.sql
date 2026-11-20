begin;

alter table public.creator_posts
  add column publication jsonb,
  add column visibility text not null default 'public' check (visibility in ('public','private')),
  add column scheduled_at timestamptz,
  add column archived_from text;
alter table public.creator_posts drop constraint creator_posts_kind_check;
alter table public.creator_posts add constraint creator_posts_kind_check check (kind in ('collection','note','video','image','article'));
alter table public.creator_posts drop constraint creator_posts_status_check;
alter table public.creator_posts add constraint creator_posts_status_check check (status in ('draft','published','scheduled','archived'));
alter table public.creator_posts add constraint creator_posts_publication_object check (publication is null or jsonb_typeof(publication)='object');
grant select (publication,visibility,scheduled_at,archived_from) on public.creator_posts to anon,authenticated;
alter policy creator_posts_public_read on public.creator_posts using (status='published' and visibility='public');
create index creator_posts_due_idx on public.creator_posts(scheduled_at) where status='scheduled';

create table public.creator_post_assets (
  post_id uuid not null references public.creator_posts(id) on delete cascade,
  path text not null,
  is_draft boolean not null default true,
  primary key(post_id,path)
);
create index creator_post_assets_path_idx on public.creator_post_assets(path);
alter table public.creator_post_assets enable row level security;
grant select on public.creator_post_assets to anon,authenticated;
create policy creator_assets_read on public.creator_post_assets for select to anon,authenticated using (
  exists (select 1 from public.creator_posts p where p.id=post_id and
    ((not is_draft and p.status='published' and p.visibility='public') or private.is_org_member(p.organization_id,array['owner','admin','editor'])))
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('creator-content-videos','creator-content-videos',false,104857600,array['video/mp4','video/webm','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function private.manage_creator_publication(
  p_store_id uuid,p_id uuid,p_action text,p_document jsonb default null,p_status text default 'draft',p_paths text[] default '{}'
) returns public.creator_posts
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := (select auth.uid()); org uuid; result public.creator_posts; due timestamptz; asset text; previous_status text;
begin
  select organization_id into org from public.stores where id=p_store_id;
  if actor is null or org is null or not private.is_org_member(org,array['owner','admin','editor']) then
    raise exception '没有内容编辑权限' using errcode='42501';
  end if;
  if p_id is not null then
    select * into result from public.creator_posts where id=p_id and store_id=p_store_id and organization_id=org for update;
    if not found then raise exception '内容不存在' using errcode='P0002'; end if;
  end if;
  if p_action='archive' then
    if p_id is null then raise exception '内容不存在'; end if;
    update public.creator_posts set archived_from=case when status='archived' then archived_from else status end,
      status='archived',updated_at=now() where id=p_id returning * into result;
    return result;
  elsif p_action='restore' then
    if result.status<>'archived' then raise exception '内容不在回收站'; end if;
    update public.creator_posts set status=coalesce(archived_from,'draft'),archived_from=null,updated_at=now()
      where id=p_id returning * into result;
    return result;
  elsif p_action<>'save' then raise exception '操作无效' using errcode='22023'; end if;
  if p_status is null or p_status not in ('draft','published','scheduled') or p_document is null or jsonb_typeof(p_document)<>'object'
    or p_document->>'version' is distinct from '1' or p_document->>'kind' is null or p_document->>'kind' not in ('video','image','article')
    or jsonb_typeof(p_document->'fields') is distinct from 'object' or p_document#>>'{fields,visibility}' is null or p_document#>>'{fields,visibility}' not in ('public','private')
    or length(p_document::text)>1000000 then raise exception '内容字段无效' using errcode='22023'; end if;
  if p_status<>'draft' and (coalesce(p_document#>>'{fields,title}','')='' or coalesce(p_document->>'coverUrl','')='') then
    raise exception '请填写标题并添加封面' using errcode='22023';
  end if;
  if p_status='scheduled' then
    due := (p_document#>>'{fields,scheduledAt}')::timestamptz;
    if due is null or due<=now() then raise exception '请选择将来的发布时间' using errcode='22023'; end if;
  end if;
  foreach asset in array p_paths loop
    if asset !~ ('^'||org::text||'/[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp4|webm|jpe?g|png|webp)$') then
      raise exception '素材不属于当前发布空间' using errcode='42501';
    end if;
  end loop;
  previous_status := result.status;
  if p_id is not null and previous_status='published' and p_status='draft' then
    update public.creator_posts set draft_version=jsonb_build_object('publication',p_document),updated_at=now()
      where id=p_id returning * into result;
    delete from public.creator_post_assets where post_id=p_id and is_draft;
    insert into public.creator_post_assets(post_id,path,is_draft) select p_id,unnest(p_paths),true on conflict do nothing;
    return result;
  end if;
  if p_id is null then
    insert into public.creator_posts(organization_id,store_id,author_id,kind,title,cover_url,body,blocks,status,publication,visibility,scheduled_at,published_at)
      values(org,p_store_id,actor,p_document->>'kind',p_document#>>'{fields,title}',p_document->>'coverUrl',coalesce(p_document->>'excerpt',''),'[]',
      p_status,p_document,p_document#>>'{fields,visibility}',due,case when p_status='published' then now() end) returning * into result;
  else
    update public.creator_posts set kind=p_document->>'kind',title=p_document#>>'{fields,title}',cover_url=p_document->>'coverUrl',
      body=coalesce(p_document->>'excerpt',''),publication=p_document,visibility=p_document#>>'{fields,visibility}',status=p_status,
      scheduled_at=due,published_at=case when p_status='published' then coalesce(published_at,now()) end,
      draft_version=null,archived_from=null,updated_at=now() where id=p_id returning * into result;
  end if;
  delete from public.creator_post_assets where post_id=result.id;
  insert into public.creator_post_assets(post_id,path,is_draft) select result.id,unnest(p_paths),p_status<>'published' on conflict do nothing;
  return result;
end;
$$;
revoke all on function private.manage_creator_publication(uuid,uuid,text,jsonb,text,text[]) from public,anon;
grant execute on function private.manage_creator_publication(uuid,uuid,text,jsonb,text,text[]) to authenticated;
create or replace function public.manage_creator_publication(
  p_store_id uuid,p_id uuid,p_action text,p_document jsonb default null,p_status text default 'draft',p_paths text[] default '{}'
) returns public.creator_posts language sql security invoker set search_path='' as $$
  select private.manage_creator_publication(p_store_id,p_id,p_action,p_document,p_status,p_paths);
$$;
revoke all on function public.manage_creator_publication(uuid,uuid,text,jsonb,text,text[]) from public,anon;
grant execute on function public.manage_creator_publication(uuid,uuid,text,jsonb,text,text[]) to authenticated;

create or replace function private.publish_due_creator_posts() returns integer
language plpgsql security definer set search_path='' as $$
declare due_ids uuid[];
begin
  with due as (update public.creator_posts set status='published',published_at=now(),updated_at=now()
    where status='scheduled' and scheduled_at<=now() returning id) select array_agg(id) into due_ids from due;
  update public.creator_post_assets set is_draft=false where post_id=any(due_ids);
  return coalesce(cardinality(due_ids),0);
end;
$$;
revoke all on function private.publish_due_creator_posts() from public,anon,authenticated;

create or replace function private.creator_publication_for_editor(p_store_id uuid,p_id uuid)
returns setof public.creator_posts language sql stable security definer set search_path='' as $$
  select p.* from public.creator_posts p where p.id=p_id and p.store_id=p_store_id
    and (select auth.uid()) is not null and private.is_org_member(p.organization_id,array['owner','admin','editor']);
$$;
revoke all on function private.creator_publication_for_editor(uuid,uuid) from public,anon;
grant execute on function private.creator_publication_for_editor(uuid,uuid) to authenticated;
create or replace function public.get_creator_publication_for_editor(p_store_id uuid,p_id uuid)
returns setof public.creator_posts language sql stable security invoker set search_path='' as $$
  select * from private.creator_publication_for_editor(p_store_id,p_id);
$$;
revoke all on function public.get_creator_publication_for_editor(uuid,uuid) from public,anon;
grant execute on function public.get_creator_publication_for_editor(uuid,uuid) to authenticated;

do $migration$
begin
  if to_regclass('public.consumer_public_information') is not null then
    execute $view$create or replace view public.consumer_public_information with(security_barrier=true) as
      select case when item_type='service' then 'service' else 'product' end::text as entity_type,id,title,
        left(coalesce(description,''),1200) as excerpt,'/store/'||publisher_slug::text||'/products/'||id::text as url,
        cover_image as image_url,publisher_name as source,created_at as updated_at,1::integer as version
      from public.discovery_products union all
      select 'content',p.id,p.title,left(coalesce(p.body,''),1200),'/discover?post='||p.id::text,p.cover_url,
        s.name,p.published_at,1 from public.creator_posts p join public.stores s on s.id=p.store_id and s.organization_id=p.organization_id
      where p.status='published' and p.visibility='public' and s.status='active' and s.deleted_at is null$view$;
  end if;
end;
$migration$;
commit;
