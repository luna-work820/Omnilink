-- Keep one equivalent SELECT policy for organization_members.
drop policy if exists organization_members_same_org_select on public.organization_members;
