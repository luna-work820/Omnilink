-- Tighten permissions: viewers may read, but only owner/admin/editor may write.
-- The helper avoids recursive RLS evaluation on organization_members.
create schema if not exists private;

create or replace function private.is_org_member(p_organization_id uuid, p_roles text[] default null)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

revoke all on function private.is_org_member(uuid, text[]) from public;
grant execute on function private.is_org_member(uuid, text[]) to authenticated;

drop policy if exists organizations_member_select on public.organizations;
drop policy if exists organizations_owner_update on public.organizations;
drop policy if exists organization_members_same_org_select on public.organization_members;
drop policy if exists organization_members_admin_write on public.organization_members;
drop policy if exists stores_member_access on public.stores;
drop policy if exists products_member_access on public.products;
drop policy if exists product_options_member_access on public.product_options;
drop policy if exists product_option_values_member_access on public.product_option_values;
drop policy if exists product_variants_member_access on public.product_variants;
drop policy if exists product_variant_option_values_member_access on public.product_variant_option_values;
drop policy if exists attribute_definitions_member_read on public.attribute_definitions;
drop policy if exists attribute_definitions_member_write on public.attribute_definitions;
drop policy if exists product_attribute_values_member_access on public.product_attribute_values;
drop policy if exists product_search_documents_member_read on public.product_search_documents;

create policy organizations_member_select on public.organizations
for select to authenticated
using (private.is_org_member(id));

create policy organizations_owner_update on public.organizations
for update to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy organization_members_same_org_select on public.organization_members
for select to authenticated
using (private.is_org_member(organization_id));

create policy organization_members_admin_insert on public.organization_members
for insert to authenticated
with check (private.is_org_member(organization_id, array['owner', 'admin']));

create policy organization_members_admin_update on public.organization_members
for update to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin']))
with check (private.is_org_member(organization_id, array['owner', 'admin']));

create policy organization_members_admin_delete on public.organization_members
for delete to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin']));

create policy stores_member_select on public.stores
for select to authenticated
using (private.is_org_member(organization_id));

create policy stores_editor_insert on public.stores
for insert to authenticated
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy stores_editor_update on public.stores
for update to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy stores_editor_delete on public.stores
for delete to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin']));

create policy products_member_select on public.products
for select to authenticated
using (private.is_org_member(organization_id));

create policy products_editor_insert on public.products
for insert to authenticated
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy products_editor_update on public.products
for update to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy products_editor_delete on public.products
for delete to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin']));

create policy product_options_member_select on public.product_options
for select to authenticated using (private.is_org_member(organization_id));
create policy product_options_editor_write on public.product_options
for all to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy product_option_values_member_select on public.product_option_values
for select to authenticated using (private.is_org_member(organization_id));
create policy product_option_values_editor_write on public.product_option_values
for all to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy product_variants_member_select on public.product_variants
for select to authenticated using (private.is_org_member(organization_id));
create policy product_variants_editor_write on public.product_variants
for all to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy product_variant_option_values_member_select on public.product_variant_option_values
for select to authenticated using (private.is_org_member(organization_id));
create policy product_variant_option_values_editor_write on public.product_variant_option_values
for all to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy attribute_definitions_member_select on public.attribute_definitions
for select to authenticated
using (organization_id is null or private.is_org_member(organization_id));

create policy attribute_definitions_editor_write on public.attribute_definitions
for all to authenticated
using (organization_id is not null and private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (organization_id is not null and private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy product_attribute_values_member_select on public.product_attribute_values
for select to authenticated using (private.is_org_member(organization_id));
create policy product_attribute_values_editor_write on public.product_attribute_values
for all to authenticated
using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']));

create policy product_search_documents_member_select on public.product_search_documents
for select to authenticated using (private.is_org_member(organization_id));

create index organization_members_user_idx on public.organization_members (user_id, status);
create index organization_members_invited_by_idx on public.organization_members (invited_by);
create index organizations_owner_idx on public.organizations (owner_user_id);
create index stores_created_by_idx on public.stores (created_by);
create index products_created_by_idx on public.products (created_by);
create index product_options_organization_idx on public.product_options (organization_id);
create index product_option_values_organization_idx on public.product_option_values (organization_id);
create index product_variant_option_values_organization_idx on public.product_variant_option_values (organization_id);
create index product_variant_option_values_option_idx on public.product_variant_option_values (option_id);
create index product_variant_option_values_option_value_idx on public.product_variant_option_values (option_value_id);
create index product_attributes_organization_idx on public.product_attribute_values (organization_id);
create index product_attributes_definition_idx on public.product_attribute_values (attribute_definition_id);
create index product_search_documents_organization_idx on public.product_search_documents (organization_id);
