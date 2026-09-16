-- Collapse overlapping SELECT policies while preserving admin-only writes.
drop policy if exists sukna_membership_admin_auth on public.sukna_memberships;
drop policy if exists sukna_membership_self_admin_auth on public.sukna_memberships;

create policy sukna_membership_select_auth
  on public.sukna_memberships
  for select to authenticated
  using ((user_id = (select auth.uid())) or sukna_has_role(organization_id, array['owner'::text,'manager'::text]));

create policy sukna_membership_insert_admin_auth
  on public.sukna_memberships
  for insert to authenticated
  with check (sukna_has_role(organization_id, array['owner'::text,'manager'::text]));

create policy sukna_membership_update_admin_auth
  on public.sukna_memberships
  for update to authenticated
  using (sukna_has_role(organization_id, array['owner'::text,'manager'::text]))
  with check (sukna_has_role(organization_id, array['owner'::text,'manager'::text]));

create policy sukna_membership_delete_admin_auth
  on public.sukna_memberships
  for delete to authenticated
  using (sukna_has_role(organization_id, array['owner'::text,'manager'::text]));
