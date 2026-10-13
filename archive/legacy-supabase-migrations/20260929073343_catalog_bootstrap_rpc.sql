create or replace function public.create_organization_and_store(
  p_organization_name text,
  p_organization_slug text,
  p_store_name text,
  p_store_slug text,
  p_currency text default 'CNY'
)
returns table (
  organization_id uuid,
  store_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_store_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.organizations (name, slug, owner_id)
  values (p_organization_name, p_organization_slug, v_user_id)
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  insert into public.stores (organization_id, name, slug, currency, created_by)
  values (v_org_id, p_store_name, p_store_slug, upper(coalesce(p_currency, 'CNY')), v_user_id)
  returning id into v_store_id;

  return query select v_org_id, v_store_id;
end;
$$;

revoke all on function public.create_organization_and_store(text, text, text, text, text) from public;
grant execute on function public.create_organization_and_store(text, text, text, text, text) to authenticated;
