-- Consolidate overlapping permissive SELECT policies while preserving access semantics.

drop policy if exists gmp_ad_creatives_admin_write on public.gmp_ad_creatives;
create policy gmp_ad_creatives_admin_insert on public.gmp_ad_creatives
  for insert to authenticated
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_creatives.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_ad_creatives_admin_update on public.gmp_ad_creatives
  for update to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_creatives.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_creatives.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_ad_creatives_admin_delete on public.gmp_ad_creatives
  for delete to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_creatives.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_ad_placements_admin_write on public.gmp_ad_placements;
create policy gmp_ad_placements_admin_insert on public.gmp_ad_placements
  for insert to authenticated
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_placements.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_ad_placements_admin_update on public.gmp_ad_placements
  for update to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_placements.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_placements.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_ad_placements_admin_delete on public.gmp_ad_placements
  for delete to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_ad_placements.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_display_content_admin_write on public.gmp_display_content;
create policy gmp_display_content_admin_insert on public.gmp_display_content
  for insert to authenticated
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_content.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_display_content_admin_update on public.gmp_display_content
  for update to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_content.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_content.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_display_content_admin_delete on public.gmp_display_content
  for delete to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_content.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_display_schedules_admin_write on public.gmp_display_schedules;
create policy gmp_display_schedules_admin_insert on public.gmp_display_schedules
  for insert to authenticated
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_schedules.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_display_schedules_admin_update on public.gmp_display_schedules
  for update to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_schedules.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_schedules.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_display_schedules_admin_delete on public.gmp_display_schedules
  for delete to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_display_schedules.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_marketplace_listings_admin_write on public.gmp_marketplace_listings;
create policy gmp_marketplace_listings_admin_insert on public.gmp_marketplace_listings
  for insert to authenticated
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_marketplace_listings.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_marketplace_listings_admin_update on public.gmp_marketplace_listings
  for update to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_marketplace_listings.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')))
  with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_marketplace_listings.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_marketplace_listings_admin_delete on public.gmp_marketplace_listings
  for delete to authenticated
  using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_marketplace_listings.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_marketplace_listings_member_read on public.gmp_marketplace_listings;
drop policy if exists gmp_marketplace_listings_public_read on public.gmp_marketplace_listings;
create policy gmp_marketplace_listings_select on public.gmp_marketplace_listings
  for select to public
  using (
    (status='active' and exists (
      select 1
      from public.gmp_store_directory d
      where d.store_id=gmp_marketplace_listings.store_id and d.status='published'
    ))
    or exists (
      select 1 from public.gmp_organization_members m
      where m.organization_id=gmp_marketplace_listings.organization_id and m.user_id=(select auth.uid())
    )
  );

drop policy if exists gmp_store_directory_admin_write on public.gmp_store_directory;
create policy gmp_store_directory_admin_insert on public.gmp_store_directory
  for insert to authenticated
  with check (exists (
    select 1 from public.gmp_stores s
    join public.gmp_organization_members m on m.organization_id=s.organization_id
    where s.id=gmp_store_directory.store_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
  ));
create policy gmp_store_directory_admin_update on public.gmp_store_directory
  for update to authenticated
  using (exists (
    select 1 from public.gmp_stores s
    join public.gmp_organization_members m on m.organization_id=s.organization_id
    where s.id=gmp_store_directory.store_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
  ))
  with check (exists (
    select 1 from public.gmp_stores s
    join public.gmp_organization_members m on m.organization_id=s.organization_id
    where s.id=gmp_store_directory.store_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
  ));
create policy gmp_store_directory_admin_delete on public.gmp_store_directory
  for delete to authenticated
  using (exists (
    select 1 from public.gmp_stores s
    join public.gmp_organization_members m on m.organization_id=s.organization_id
    where s.id=gmp_store_directory.store_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')
  ));

drop policy if exists gmp_store_directory_member_read on public.gmp_store_directory;
drop policy if exists gmp_store_directory_public_read on public.gmp_store_directory;
create policy gmp_store_directory_select on public.gmp_store_directory
  for select to public
  using (
    status='published'
    or exists (
      select 1
      from public.gmp_stores s
      join public.gmp_organization_members m on m.organization_id=s.organization_id
      where s.id=gmp_store_directory.store_id and m.user_id=(select auth.uid())
    )
  );
