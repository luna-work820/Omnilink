drop policy if exists sales_channels_admin_write on public.sales_channels;

drop policy if exists stores_editor_write on public.stores;
drop policy if exists stores_editor_insert on public.stores;
drop policy if exists stores_editor_update on public.stores;
drop policy if exists stores_editor_delete on public.stores;
create policy stores_editor_insert on public.stores for insert to authenticated
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy stores_editor_update on public.stores for update to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']))
  with check (private.is_org_member(organization_id, array['owner','admin','editor']));
create policy stores_editor_delete on public.stores for delete to authenticated
  using (private.is_org_member(organization_id, array['owner','admin','editor']));
