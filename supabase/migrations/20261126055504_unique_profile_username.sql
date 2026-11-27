alter table public.profiles
  add constraint profiles_display_name_valid
  check (display_name is not null and char_length(btrim(display_name)) between 1 and 40);

create unique index profiles_display_name_unique
  on public.profiles (lower(btrim(display_name)));

create schema if not exists signup_private;
revoke all on schema signup_private from public;
grant usage on schema signup_private to anon, authenticated, service_role;

create function signup_private.username_taken(candidate text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select char_length(btrim(candidate)) between 1 and 40
    and exists (
      select 1 from public.profiles
      where lower(btrim(display_name)) = lower(btrim(candidate))
    );
$$;
revoke all on function signup_private.username_taken(text) from public, anon, authenticated;
grant execute on function signup_private.username_taken(text) to anon, authenticated, service_role;

create function public.signup_username_taken(candidate text)
returns boolean
language sql stable security invoker set search_path = ''
as $$ select signup_private.username_taken(candidate); $$;
revoke all on function public.signup_username_taken(text) from public, anon, authenticated;
grant execute on function public.signup_username_taken(text) to anon, authenticated, service_role;

create function private.guard_profile_username()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and new.display_name is distinct from old.display_name then
    raise exception '用户名请通过账号设置修改' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_profile_username() from public, anon, authenticated;

create trigger guard_profile_username
  before update of display_name on public.profiles
  for each row execute function private.guard_profile_username();

create function private.sync_profile_username()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles
    set display_name = nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')), ''), updated_at = now()
    where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_profile_username() from public, anon, authenticated;

create trigger sync_profile_username
  after update of raw_user_meta_data on auth.users
  for each row
  when (coalesce(old.raw_user_meta_data ->> 'full_name', old.raw_user_meta_data ->> 'name')
    is distinct from coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  execute function private.sync_profile_username();
