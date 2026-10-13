-- Workspace-visible skill catalogue, installation state, and auditable runs.
-- Skill contracts stay versioned JSON because each skill accepts different input/output schemas.

create table public.workspace_skills (
  id text primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text not null,
  icon text not null default 'sparkles',
  category text not null default 'merchant_profile' check (category in (
    'merchant_profile', 'brand', 'copywriting', 'analysis', 'compliance', 'other'
  )),
  visibility text not null default 'system' check (visibility in ('system', 'organization')),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (visibility = 'system' and organization_id is null)
    or (visibility = 'organization' and organization_id is not null)
  )
);

create table public.workspace_skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id text not null references public.workspace_skills(id) on delete cascade,
  version text not null,
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (skill_id, version),
  unique (id, skill_id)
);

create table public.store_workspace_skills (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  skill_id text not null references public.workspace_skills(id) on delete restrict,
  skill_version_id uuid,
  is_enabled boolean not null default true,
  selection_mode text not null default 'manual' check (selection_mode in ('manual', 'auto_recommended')),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, skill_id),
  foreign key (skill_version_id, skill_id)
    references public.workspace_skill_versions (id, skill_id) on delete restrict
);

create table public.workspace_skill_runs (
  id uuid primary key default gen_random_uuid(),
  store_skill_id uuid not null references public.store_workspace_skills(id) on delete cascade,
  source_id uuid references public.merchant_profile_sources(id) on delete set null,
  profile_update_id uuid references public.merchant_profile_updates(id) on delete set null,
  triggered_by uuid references auth.users(id) on delete set null,
  trigger_type text not null check (trigger_type in ('manual', 'auto_match', 'retry')),
  status text not null default 'queued' check (status in (
    'queued', 'running', 'ready_for_review', 'completed', 'failed', 'cancelled'
  )),
  input_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(input_snapshot) = 'object'),
  output_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(output_snapshot) = 'object'),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index workspace_skill_versions_skill_active_idx
  on public.workspace_skill_versions (skill_id, is_active, created_at desc);

create index store_workspace_skills_store_enabled_idx
  on public.store_workspace_skills (store_id, is_enabled, created_at desc);

create index workspace_skill_runs_store_skill_status_created_idx
  on public.workspace_skill_runs (store_skill_id, status, created_at desc);

alter table public.workspace_skills enable row level security;
alter table public.workspace_skill_versions enable row level security;
alter table public.store_workspace_skills enable row level security;
alter table public.workspace_skill_runs enable row level security;

create policy workspace_skills_member_select on public.workspace_skills
  for select to authenticated
  using (organization_id is null or private.is_org_member(organization_id));

create policy workspace_skills_org_editor_write on public.workspace_skills
  for all to authenticated
  using (
    organization_id is not null
    and private.is_org_member(organization_id, array['owner', 'admin', 'editor'])
  )
  with check (
    organization_id is not null
    and private.is_org_member(organization_id, array['owner', 'admin', 'editor'])
  );

create policy workspace_skill_versions_member_select on public.workspace_skill_versions
  for select to authenticated
  using (exists (
    select 1 from public.workspace_skills s
    where s.id = skill_id
      and (s.organization_id is null or private.is_org_member(s.organization_id))
  ));

create policy workspace_skill_versions_org_editor_write on public.workspace_skill_versions
  for all to authenticated
  using (exists (
    select 1 from public.workspace_skills s
    where s.id = skill_id
      and s.organization_id is not null
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ))
  with check (exists (
    select 1 from public.workspace_skills s
    where s.id = skill_id
      and s.organization_id is not null
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ));

create policy store_workspace_skills_member_select on public.store_workspace_skills
  for select to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id and private.is_org_member(s.organization_id)
  ));

create policy store_workspace_skills_editor_write on public.store_workspace_skills
  for all to authenticated
  using (exists (
    select 1 from public.stores s
    where s.id = store_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = store_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ));

create policy workspace_skill_runs_member_select on public.workspace_skill_runs
  for select to authenticated
  using (exists (
    select 1
    from public.store_workspace_skills ss
    join public.stores s on s.id = ss.store_id
    where ss.id = store_skill_id and private.is_org_member(s.organization_id)
  ));

create policy workspace_skill_runs_editor_write on public.workspace_skill_runs
  for all to authenticated
  using (exists (
    select 1
    from public.store_workspace_skills ss
    join public.stores s on s.id = ss.store_id
    where ss.id = store_skill_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ))
  with check (exists (
    select 1
    from public.store_workspace_skills ss
    join public.stores s on s.id = ss.store_id
    where ss.id = store_skill_id
      and private.is_org_member(s.organization_id, array['owner', 'admin', 'editor'])
  ));

insert into public.workspace_skills (id, name, description, icon, category, visibility)
values
  ('merchant-profile', '商家档案解析', '从商家填写内容、上传资料或链接中提取带来源依据的商家档案，并以待确认变更的形式更新知识库。', 'building-2', 'merchant_profile', 'system'),
  ('brand-proposal', '品牌提案', '基于已确认的商家档案生成可审核的定位、语气、视觉方向与品牌候选内容。', 'palette', 'brand', 'system'),
  ('store-copy', '店铺文案', '将确认后的商家资料转换为可审核的店铺与商品文案，不将生成内容写回事实档案。', 'file-pen-line', 'copywriting', 'system');

insert into public.workspace_skill_versions (skill_id, version, manifest)
values
  ('merchant-profile', '0.5.0', '{"input_types":["merchant_answer","document","image","spreadsheet","website","url","pasted_text"],"output":"merchant_profile_update","review_required":true}'::jsonb),
  ('brand-proposal', '1.1.0', '{"input_types":["merchant_profile"],"output":"brand_proposal","review_required":true}'::jsonb),
  ('store-copy', '1.1.0', '{"input_types":["merchant_profile","brand_proposal"],"output":"store_copy_draft","review_required":true}'::jsonb);
