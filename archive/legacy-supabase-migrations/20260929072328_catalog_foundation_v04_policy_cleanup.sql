do $$
declare
  t text;
begin
  foreach t in array array[
    'product_options',
    'product_option_values',
    'product_variants',
    'product_variant_option_values',
    'product_attribute_values',
    'attribute_definitions'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_editor_write', t);
    execute format($policy$
      create policy %I on public.%I for insert to authenticated
      with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
    $policy$, t || '_editor_insert', t);
    execute format($policy$
      create policy %I on public.%I for update to authenticated
      using (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
      with check (private.is_org_member(organization_id, array['owner', 'admin', 'editor']))
    $policy$, t || '_editor_update', t);
    execute format($policy$
      create policy %I on public.%I for delete to authenticated
      using (private.is_org_member(organization_id, array['owner', 'admin']))
    $policy$, t || '_editor_delete', t);
  end loop;
end;
$$;
