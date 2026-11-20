-- Explicit constraint targets avoid collisions with the returned organization_id/store_id columns.
create or replace function public.create_organization_and_store(
  p_organization_name text,
  p_organization_slug text,
  p_store_name text,
  p_store_slug text,
  p_currency text default 'CNY'
)
returns table (organization_id uuid, store_id uuid)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_store_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if nullif(trim(p_organization_name), '') is null
    or nullif(trim(p_organization_slug), '') is null
    or nullif(trim(p_store_name), '') is null
    or nullif(trim(p_store_slug), '') is null then
    raise exception 'Organization and store names and slugs are required' using errcode = '22023';
  end if;
  if upper(coalesce(p_currency, 'CNY')) not in ('CNY', 'USD') then
    raise exception 'Unsupported currency' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, owner_user_id)
  values (trim(p_organization_name), trim(p_organization_slug), v_user_id)
  on conflict (slug) do nothing
  returning id into v_organization_id;

  if v_organization_id is null then
    select o.id into v_organization_id
    from public.organizations o
    join public.organization_members m on m.organization_id = o.id
    where o.slug = trim(p_organization_slug)
      and m.user_id = v_user_id
      and m.status = 'active'
      and m.role in ('owner', 'admin')
    limit 1;
    if v_organization_id is null then
      raise exception 'Organization slug is already in use' using errcode = '23505';
    end if;
  else
    insert into public.organization_members (organization_id, user_id, role, status)
    values (v_organization_id, v_user_id, 'owner', 'active')
    on conflict on constraint organization_members_organization_id_user_id_key do update
      set role = 'owner', status = 'active';
  end if;

  insert into public.stores (organization_id, name, slug, currency)
  values (v_organization_id, trim(p_store_name), trim(p_store_slug), upper(coalesce(p_currency, 'CNY')))
  on conflict on constraint stores_organization_id_slug_key do nothing
  returning id into v_store_id;

  if v_store_id is null then
    select s.id into v_store_id from public.stores s
    where s.organization_id = v_organization_id and s.slug = trim(p_store_slug)
    limit 1;
  end if;

  insert into public.store_settings (store_id)
  values (v_store_id)
  on conflict on constraint store_settings_store_id_key do nothing;

  insert into public.sales_channels (organization_id, code, name, channel_type, status)
  values (v_organization_id, 'storefront', 'C 端商城', 'storefront', 'active')
  on conflict on constraint sales_channels_organization_id_code_key do nothing;

  return query select v_organization_id, v_store_id;
end;
$$;

revoke all on function public.create_organization_and_store(text, text, text, text, text) from public, anon;
grant execute on function public.create_organization_and_store(text, text, text, text, text) to authenticated;
