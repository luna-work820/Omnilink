-- Remove the duplicate covering index and cover the new catalog category FK.
drop index if exists public.catalog_contents_item_organization_fk_idx;
create index if not exists catalog_items_category_organization_fk_idx
  on public.catalog_items (category_id, organization_id)
  where category_id is not null;

-- A review column is not an authorization boundary by itself. Restrict
-- approval/publication transitions to organization owners and admins.
create or replace function private.guard_reviewed_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_status text := to_jsonb(new)->>'status';
  previous_status text := case when tg_op = 'UPDATE' then to_jsonb(old)->>'status' else null end;
  target_org uuid := (to_jsonb(new)->>'organization_id')::uuid;
begin
  -- Server-side jobs run without an end-user auth.uid(); table grants/RLS
  -- remain the boundary for user-facing requests.
  if auth.uid() is null then
    return new;
  end if;

  if next_status in ('approved', 'published') and
     (tg_op = 'INSERT' or previous_status is distinct from next_status) and
     not private.is_org_member(target_org, array['owner','admin']) then
    raise exception 'Only organization owners or admins may approve or publish records';
  end if;

  if tg_op = 'UPDATE' and previous_status in ('approved','published') and
     to_jsonb(old) is distinct from to_jsonb(new) and
     not private.is_org_member(target_org, array['owner','admin']) then
    raise exception 'Approved or published records are locked; create a new revision instead';
  end if;

  if next_status = 'applied' and tg_table_name = 'catalog_item_change_sets' and
     previous_status is distinct from 'approved' then
    raise exception 'Only approved change sets may be applied';
  end if;

  if next_status in ('approved', 'published') and tg_table_name in ('catalog_contents','storefront_versions') then
    if to_jsonb(new)->>'reviewed_by' is distinct from auth.uid()::text or to_jsonb(new)->>'reviewed_at' is null then
      raise exception 'Approval and publication require reviewer attribution';
    end if;
  end if;

  if tg_table_name = 'storefronts' and next_status = 'published' and not exists (
    select 1 from public.storefront_versions v
    where v.id = new.published_version_id
      and v.store_id = new.store_id
      and v.organization_id = new.organization_id
      and v.status = 'published'
  ) then
    raise exception 'A storefront can only publish a published version belonging to that store';
  end if;

  return new;
end;
$$;

create trigger catalog_contents_review_guard
before insert or update on public.catalog_contents
for each row execute function private.guard_reviewed_status();

create trigger storefront_versions_review_guard
before insert or update on public.storefront_versions
for each row execute function private.guard_reviewed_status();

create trigger catalog_item_change_sets_review_guard
before insert or update on public.catalog_item_change_sets
for each row execute function private.guard_reviewed_status();

create trigger storefronts_publish_guard
before insert or update on public.storefronts
for each row execute function private.guard_reviewed_status();

-- Public visitors may read only the currently published storefront snapshot,
-- never drafts or historical versions. Keep all writes member-only.
grant select on public.storefronts, public.storefront_versions to anon;
create policy storefronts_public_published_select on public.storefronts
  for select to anon using (status = 'published' and published_version_id is not null);
create policy storefront_versions_public_current_select on public.storefront_versions
  for select to anon using (
    status = 'published' and exists (
      select 1 from public.storefronts s
      where s.store_id = storefront_versions.store_id
        and s.organization_id = storefront_versions.organization_id
        and s.status = 'published'
        and s.published_version_id = storefront_versions.id
    )
  );
