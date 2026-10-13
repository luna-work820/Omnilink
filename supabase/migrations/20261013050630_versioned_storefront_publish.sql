-- One transaction creates a version and switches the public pointer.
-- The function runs as the caller; table RLS remains in force.
-- Editors may advance the draft pointer without changing the published page.
create or replace function private.guard_storefront_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_publication_change boolean := false;
begin
  if auth.uid() is null then return new; end if;

  if not private.is_org_member(new.organization_id, array['owner','admin','editor']) then
    raise exception 'Store not found or forbidden';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'published'
       and not private.is_org_member(new.organization_id, array['owner','admin'])
       and (
         new.status is distinct from old.status
         or new.published_version_id is distinct from old.published_version_id
         or new.organization_id is distinct from old.organization_id
         or new.custom_domain is distinct from old.custom_domain
         or new.settings is distinct from old.settings
       ) then
      raise exception 'Only owners and admins may change a published storefront';
    end if;
    v_publication_change := old.status is distinct from 'published'
      or new.published_version_id is distinct from old.published_version_id;
  else
    v_publication_change := true;
  end if;

  if new.status = 'published' and v_publication_change then
    if not private.is_org_member(new.organization_id, array['owner','admin']) then
      raise exception 'Only owners and admins may publish';
    end if;
    if not exists (
      select 1 from public.storefront_versions v
      where v.id = new.published_version_id
        and v.store_id = new.store_id
        and v.organization_id = new.organization_id
        and v.status = 'published'
    ) then
      raise exception 'Published version must belong to this store';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists storefronts_publish_guard on public.storefronts;
create trigger storefronts_publish_guard
before insert or update on public.storefronts
for each row execute function private.guard_storefront_publication();

create or replace function public.save_storefront_version(
  p_store_id uuid,
  p_schema jsonb,
  p_publish boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_version_id uuid;
  v_version_number integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_schema) is distinct from 'object'
     or jsonb_typeof(p_schema->'sections') is distinct from 'array'
     or jsonb_typeof(p_schema->'theme') is distinct from 'object' then
    raise exception 'Invalid storefront schema';
  end if;

  select s.organization_id
    into v_organization_id
  from public.stores s
  where s.id = p_store_id;

  if v_organization_id is null
     or not private.is_org_member(v_organization_id, array['owner','admin','editor']) then
    raise exception 'Store not found or forbidden';
  end if;

  if p_publish and not private.is_org_member(v_organization_id, array['owner','admin']) then
    raise exception 'Only owners and admins may publish';
  end if;

  insert into public.storefronts (store_id, organization_id, status)
  values (p_store_id, v_organization_id, 'draft')
  on conflict (store_id) do nothing;

  perform 1 from public.storefronts
  where store_id = p_store_id and organization_id = v_organization_id
  for update;

  -- The row lock serializes version numbers until the RPC commits.
  select coalesce(max(v.version_number), 0) + 1
    into v_version_number
  from public.storefront_versions v
  where v.store_id = p_store_id;

  insert into public.storefront_versions (
    store_id, organization_id, version_number, status, schema_document,
    created_by, reviewed_by, reviewed_at, published_at
  ) values (
    p_store_id, v_organization_id, v_version_number,
    case when p_publish then 'published' else 'draft' end,
    p_schema, auth.uid(),
    case when p_publish then auth.uid() else null end,
    case when p_publish then now() else null end,
    case when p_publish then now() else null end
  ) returning id into v_version_id;

  if p_publish then
    update public.storefronts
    set status = 'published',
        published_version_id = v_version_id,
        draft_version_id = null,
        updated_at = now()
    where store_id = p_store_id;

    -- Keep legacy readers in sync during the transition. Any failure rolls
    -- back the version switch instead of leaving two public states.
    insert into public.store_settings (store_id, theme_config, seo_config)
    values (p_store_id, p_schema, '{}'::jsonb)
    on conflict (store_id) do update
      set theme_config = excluded.theme_config;

    insert into public.store_pages (store_id, sections, published)
    values (p_store_id, p_schema->'sections', true)
    on conflict (store_id) do update
      set sections = excluded.sections,
          published = true;
  else
    update public.storefronts
    set draft_version_id = v_version_id,
        updated_at = now()
    where store_id = p_store_id;
  end if;

  return v_version_id;
end;
$$;

revoke all on function public.save_storefront_version(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_storefront_version(uuid, jsonb, boolean) to authenticated;

create or replace function public.unpublish_storefront_version(p_store_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select s.organization_id into v_organization_id
  from public.stores s
  where s.id = p_store_id;

  if v_organization_id is null
     or not private.is_org_member(v_organization_id, array['owner','admin']) then
    raise exception 'Store not found or forbidden';
  end if;

  insert into public.storefronts (store_id, organization_id, status)
  values (p_store_id, v_organization_id, 'paused')
  on conflict (store_id) do update
    set status = 'paused', updated_at = now();

  update public.store_pages
  set published = false
  where store_id = p_store_id;
end;
$$;

revoke all on function public.unpublish_storefront_version(uuid) from public, anon;
grant execute on function public.unpublish_storefront_version(uuid) to authenticated;

-- Signed-in visitors need the same published projection as anonymous visitors.
create policy storefronts_authenticated_public_published_select on public.storefronts
  for select to authenticated
  using (status = 'published' and published_version_id is not null);

create policy storefront_versions_authenticated_public_current_select on public.storefront_versions
  for select to authenticated
  using (
    status = 'published' and exists (
      select 1 from public.storefronts s
      where s.store_id = storefront_versions.store_id
        and s.organization_id = storefront_versions.organization_id
        and s.status = 'published'
        and s.published_version_id = storefront_versions.id
    )
  );

grant select on public.published_storefronts to authenticated;
