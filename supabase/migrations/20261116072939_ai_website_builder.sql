create table public.ai_websites (
  store_id uuid primary key references public.stores(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  draft_build_id uuid,
  published_build_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ai_website_builds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.ai_websites(store_id) on delete cascade,
  request_id uuid not null,
  created_by uuid not null references auth.users(id),
  base_build_id uuid,
  prompt text not null check (length(prompt) between 1 and 4000),
  status text not null default 'queued' check (status in ('queued','generating','building','ready','failed','cancelled')),
  revision integer not null default 0,
  source jsonb,
  artifacts jsonb,
  artifact_digest text,
  error text,
  deadline_at timestamptz not null default (now() + interval '8 minutes'),
  preview_runtime jsonb,
  public_runtime jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,request_id),
  unique(store_id,id),
  check (source is null or octet_length(source::text) < 1100000),
  check (artifacts is null or octet_length(artifacts::text) < 10000000),
  check (status <> 'ready' or coalesce((source->>'dataVersion' = '1' and source->>'runtimeVersion' = '1' and source->>'id' ~ '^[a-f0-9]{64}$' and artifacts is not null and artifact_digest ~ '^[a-f0-9]{64}$'),false))
);
alter table public.ai_websites add constraint ai_websites_draft_fk foreign key(store_id,draft_build_id) references public.ai_website_builds(store_id,id);
alter table public.ai_websites add constraint ai_websites_published_fk foreign key(store_id,published_build_id) references public.ai_website_builds(store_id,id);
create unique index ai_website_one_running on public.ai_website_builds(store_id) where status in ('queued','generating','building');
create index ai_website_build_history on public.ai_website_builds(store_id,created_at desc);
create index ai_websites_organization on public.ai_websites(organization_id);
create table public.ai_website_releases (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.ai_websites(store_id) on delete cascade,
  build_id uuid,
  action text not null check(action in ('publish','rollback','unpublish')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key(store_id,build_id) references public.ai_website_builds(store_id,id)
);
create index ai_website_release_history on public.ai_website_releases(store_id,created_at desc);
alter table public.ai_websites enable row level security;
alter table public.ai_website_builds enable row level security;
alter table public.ai_website_releases enable row level security;
create policy ai_websites_member_read on public.ai_websites for select to authenticated using (exists (
  select 1 from public.organization_members m where m.organization_id=ai_websites.organization_id and m.user_id=(select auth.uid()) and m.status='active' and m.role in ('owner','admin','editor')
));
create policy ai_website_builds_member_read on public.ai_website_builds for select to authenticated using (exists (
  select 1 from public.ai_websites s where s.store_id=ai_website_builds.store_id
));
create policy ai_website_releases_member_read on public.ai_website_releases for select to authenticated using (exists (
  select 1 from public.ai_websites s where s.store_id=ai_website_releases.store_id
));
revoke all on public.ai_websites,public.ai_website_builds,public.ai_website_releases from anon,authenticated;
grant select on public.ai_websites,public.ai_website_releases to authenticated;
grant select(id,store_id,request_id,created_by,base_build_id,prompt,status,revision,error,created_at,updated_at) on public.ai_website_builds to authenticated;
grant all on public.ai_websites,public.ai_website_builds,public.ai_website_releases to service_role;

create or replace function public.manage_ai_website(p_user uuid,p_store uuid,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_org uuid; v_role text; v_site public.ai_websites; v_build public.ai_website_builds; v_id uuid; v_runtime jsonb; v_mode text;
begin
  select organization_id into v_org from public.stores where id=p_store and status='active';
  if v_org is null then raise exception 'STORE_NOT_FOUND' using errcode='P0002'; end if;
  if p_user is not null then
    select role into v_role from public.organization_members where organization_id=v_org and user_id=p_user and status='active' and role in ('owner','admin','editor') limit 1;
  end if;
  if v_role is null and not (p_user is null and p_action in ('runtime_claim','runtime_commit') and p_payload->>'mode'='public') then
    raise exception 'WEBSITE_FORBIDDEN' using errcode='42501';
  end if;
  if p_action='start' then
    if length(trim(coalesce(p_payload->>'prompt',''))) not between 1 and 4000 then raise exception 'INVALID_PROMPT'; end if;
    insert into public.ai_websites(store_id,organization_id) values(p_store,v_org) on conflict(store_id) do nothing;
  end if;
  select * into v_site from public.ai_websites where store_id=p_store for update;
  if not found then raise exception 'WEBSITE_NOT_FOUND' using errcode='P0002'; end if;
  update public.ai_website_builds set status='failed',error='任务超时，请重试',revision=revision+1,updated_at=now()
    where store_id=p_store and status in ('queued','generating','building') and deadline_at<now();
  if p_action='expire' then return to_jsonb(v_site); end if;
  if p_action='start' then
    select * into v_build from public.ai_website_builds where store_id=p_store and request_id=(p_payload->>'requestId')::uuid;
    if found then
      if v_build.prompt<>p_payload->>'prompt' or v_build.base_build_id is distinct from nullif(p_payload->>'baseBuildId','')::uuid then raise exception 'REQUEST_CONFLICT' using errcode='40001'; end if;
      return to_jsonb(v_build)||jsonb_build_object('existing',true);
    end if;
    if v_site.draft_build_id is distinct from nullif(p_payload->>'baseBuildId','')::uuid then raise exception 'SOURCE_VERSION_CONFLICT' using errcode='40001'; end if;
    if exists(select 1 from public.ai_website_builds where store_id=p_store and status in ('queued','generating','building')) then raise exception 'WEBSITE_BUSY' using errcode='40001'; end if;
    insert into public.ai_website_builds(store_id,request_id,created_by,base_build_id,prompt,status)
      values(p_store,(p_payload->>'requestId')::uuid,p_user,v_site.draft_build_id,p_payload->>'prompt','generating') returning * into v_build;
    return to_jsonb(v_build)||jsonb_build_object('existing',false);
  end if;
  if p_action='unpublish' then
    if v_role not in ('owner','admin') then raise exception 'PUBLISH_FORBIDDEN' using errcode='42501'; end if;
    update public.ai_websites set published_build_id=null,updated_at=now() where store_id=p_store;
    insert into public.ai_website_releases(store_id,build_id,action,created_by) values(p_store,v_site.published_build_id,'unpublish',p_user);
    return jsonb_build_object('published',false);
  end if;
  select * into v_build from public.ai_website_builds where store_id=p_store and id=(p_payload->>'buildId')::uuid for update;
  if not found then raise exception 'BUILD_NOT_FOUND' using errcode='P0002'; end if;
  if p_action in ('building','finish','fail','cancel') then
    if v_build.revision<>coalesce((p_payload->>'expectedRevision')::integer,-1) then raise exception 'JOB_VERSION_CONFLICT' using errcode='40001'; end if;
    if v_build.status not in ('generating','building') then raise exception 'JOB_FINISHED' using errcode='40001'; end if;
    if p_action='building' and v_build.status<>'generating' then raise exception 'INVALID_JOB_TRANSITION'; end if;
    if p_action='finish' and (v_build.status<>'building' or v_site.draft_build_id is distinct from v_build.base_build_id) then raise exception 'SOURCE_VERSION_CONFLICT' using errcode='40001'; end if;
    update public.ai_website_builds set
      status=case p_action when 'finish' then 'ready' when 'fail' then 'failed' when 'cancel' then 'cancelled' else 'building' end,
      source=case when p_action='building' then p_payload->'source' else source end,
      artifacts=case when p_action='finish' then p_payload->'artifacts' else artifacts end,
      artifact_digest=case when p_action='finish' then p_payload->>'artifactDigest' else artifact_digest end,
      error=case when p_action='fail' then left(p_payload->>'error',500) else null end,
      revision=revision+1,updated_at=now()
      where id=v_build.id returning * into v_build;
    if p_action='finish' then update public.ai_websites set draft_build_id=v_build.id,updated_at=now() where store_id=p_store; end if;
    return to_jsonb(v_build);
  elsif p_action in ('publish','rollback') then
    if v_role not in ('owner','admin') then raise exception 'PUBLISH_FORBIDDEN' using errcode='42501'; end if;
    if v_build.status<>'ready' or v_build.source->>'dataVersion'<>'1' or v_build.source->>'runtimeVersion'<>'1' then raise exception 'BUILD_NOT_READY'; end if;
    if p_action='publish' and v_site.draft_build_id<>v_build.id then raise exception 'SOURCE_VERSION_CONFLICT' using errcode='40001'; end if;
    if p_action='rollback' and not exists(select 1 from public.ai_website_releases where store_id=p_store and build_id=v_build.id) then raise exception 'RELEASE_NOT_FOUND'; end if;
    update public.ai_websites set published_build_id=v_build.id,updated_at=now() where store_id=p_store;
    insert into public.ai_website_releases(store_id,build_id,action,created_by) values(p_store,v_build.id,p_action,p_user);
    return jsonb_build_object('published',true,'buildId',v_build.id);
  elsif p_action in ('runtime_claim','runtime_commit') then
    v_mode=p_payload->>'mode';
    if v_mode not in ('preview','public') or v_build.status<>'ready' then raise exception 'INVALID_RUNTIME'; end if;
    if v_mode='public' and v_site.published_build_id is distinct from v_build.id then raise exception 'NOT_PUBLISHED' using errcode='P0002'; end if;
    v_runtime=case when v_mode='preview' then v_build.preview_runtime else v_build.public_runtime end;
    if p_action='runtime_claim' then
      if v_runtime is not null and (v_runtime->>'expiresAt')::timestamptz>now() then return v_runtime||jsonb_build_object('claimed',false); end if;
      v_runtime=jsonb_build_object('lease',p_payload->>'lease','expiresAt',now()+interval '45 seconds');
    else
      if v_runtime->>'lease' is distinct from p_payload->>'lease' then raise exception 'RUNTIME_LEASE_LOST' using errcode='40001'; end if;
      v_runtime=p_payload->'runtime';
    end if;
    update public.ai_website_builds set preview_runtime=case when v_mode='preview' then v_runtime else preview_runtime end,
      public_runtime=case when v_mode='public' then v_runtime else public_runtime end where id=v_build.id;
    return v_runtime||jsonb_build_object('claimed',true);
  end if;
  raise exception 'UNKNOWN_WEBSITE_ACTION';
end $$;
revoke all on function public.manage_ai_website(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_ai_website(uuid,uuid,text,jsonb) to service_role;
