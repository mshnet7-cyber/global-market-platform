-- Stage 2 Final Release Audit: defense-in-depth organization/reference isolation.
-- Additive only. No data is deleted or altered destructively.

create or replace function public.gmp_stage2_validate_reference_scope()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ref_org uuid;
  ref_store uuid;
  ref_campaign uuid;
  ref_product_org uuid;
  ref_product_store uuid;
begin
  if tg_table_name = 'gmp_marketplace_listings' then
    select s.organization_id into ref_org from public.gmp_stores s where s.id = new.store_id;
    if ref_org is null or ref_org <> new.organization_id then raise exception 'cross_tenant_store_reference'; end if;
    if new.product_id is not null then
      select p.organization_id,p.store_id into ref_product_org,ref_product_store from public.gmp_products p where p.id=new.product_id;
      if ref_product_org is null or ref_product_org<>new.organization_id or ref_product_store<>new.store_id then raise exception 'cross_tenant_product_reference'; end if;
    end if;
  elsif tg_table_name = 'gmp_marketplace_orders' then
    select s.organization_id into ref_org from public.gmp_stores s where s.id = new.store_id;
    if ref_org is null or ref_org <> new.organization_id then raise exception 'cross_tenant_store_reference'; end if;
  elsif tg_table_name = 'gmp_marketplace_order_lines' then
    select o.organization_id,o.store_id into ref_org,ref_store from public.gmp_marketplace_orders o where o.id=new.order_id;
    if not found then raise exception 'order_reference_invalid'; end if;
    if not exists (select 1 from public.gmp_marketplace_listings l where l.id=new.listing_id and l.organization_id=ref_org and l.store_id=ref_store) then
      raise exception 'cross_tenant_listing_reference';
    end if;
  elsif tg_table_name = 'gmp_display_content' then
    select s.organization_id into ref_org from public.gmp_stores s where s.id=new.store_id;
    if ref_org is null or ref_org<>new.organization_id then raise exception 'cross_tenant_store_reference'; end if;
    if new.screen_id is not null then
      select s.organization_id,s.id into ref_org,ref_store
      from public.gmp_screens sc join public.gmp_stores s on s.id=sc.store_id where sc.id=new.screen_id;
      if ref_org is null or ref_org<>new.organization_id or ref_store<>new.store_id then raise exception 'cross_tenant_screen_reference'; end if;
    end if;
  elsif tg_table_name = 'gmp_display_schedules' then
    select s.organization_id into ref_org from public.gmp_stores s where s.id=new.store_id;
    if ref_org is null or ref_org<>new.organization_id then raise exception 'cross_tenant_store_reference'; end if;
    if not exists (select 1 from public.gmp_screens sc where sc.id=new.screen_id and sc.store_id=new.store_id) then raise exception 'cross_tenant_screen_reference'; end if;
    if not exists (select 1 from public.gmp_display_content dc where dc.id=new.content_id and dc.organization_id=new.organization_id and dc.store_id=new.store_id) then raise exception 'cross_tenant_content_reference'; end if;
  elsif tg_table_name = 'gmp_ad_creatives' then
    select c.organization_id,c.id into ref_org,ref_campaign from public.gmp_ad_campaigns c where c.id=new.campaign_id;
    if ref_org is null or ref_org<>new.organization_id then raise exception 'cross_tenant_campaign_reference'; end if;
  elsif tg_table_name = 'gmp_ad_campaigns' then
    if new.store_id is not null then
      select s.organization_id into ref_org from public.gmp_stores s where s.id=new.store_id;
      if ref_org is null or ref_org<>new.organization_id then raise exception 'cross_tenant_store_reference'; end if;
    end if;
  elsif tg_table_name = 'gmp_ad_placements' then
    select c.organization_id into ref_org from public.gmp_ad_campaigns c where c.id=new.campaign_id;
    if ref_org is null or ref_org<>new.organization_id then raise exception 'cross_tenant_campaign_reference'; end if;
    if new.store_id is not null then
      select s.organization_id into ref_org from public.gmp_stores s where s.id=new.store_id;
      if ref_org is null or ref_org<>new.organization_id then raise exception 'cross_tenant_store_reference'; end if;
    end if;
    if new.screen_id is not null then
      select s.organization_id,s.id into ref_org,ref_store
      from public.gmp_screens sc join public.gmp_stores s on s.id=sc.store_id where sc.id=new.screen_id;
      if ref_org is null or ref_org<>new.organization_id then raise exception 'cross_tenant_screen_reference'; end if;
      if new.store_id is not null and ref_store<>new.store_id then raise exception 'screen_store_mismatch'; end if;
    end if;
    if new.creative_id is not null and not exists (
      select 1 from public.gmp_ad_creatives cr where cr.id=new.creative_id and cr.organization_id=new.organization_id and cr.campaign_id=new.campaign_id
    ) then raise exception 'cross_tenant_creative_reference'; end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists gmp_stage2_scope_marketplace_listings on public.gmp_marketplace_listings;
create trigger gmp_stage2_scope_marketplace_listings before insert or update on public.gmp_marketplace_listings for each row execute function public.gmp_stage2_validate_reference_scope();
drop trigger if exists gmp_stage2_scope_marketplace_orders on public.gmp_marketplace_orders;
create trigger gmp_stage2_scope_marketplace_orders before insert or update on public.gmp_marketplace_orders for each row execute function public.gmp_stage2_validate_reference_scope();
drop trigger if exists gmp_stage2_scope_marketplace_order_lines on public.gmp_marketplace_order_lines;
create trigger gmp_stage2_scope_marketplace_order_lines before insert or update on public.gmp_marketplace_order_lines for each row execute function public.gmp_stage2_validate_reference_scope();
drop trigger if exists gmp_stage2_scope_display_content on public.gmp_display_content;
create trigger gmp_stage2_scope_display_content before insert or update on public.gmp_display_content for each row execute function public.gmp_stage2_validate_reference_scope();
drop trigger if exists gmp_stage2_scope_display_schedules on public.gmp_display_schedules;
create trigger gmp_stage2_scope_display_schedules before insert or update on public.gmp_display_schedules for each row execute function public.gmp_stage2_validate_reference_scope();
drop trigger if exists gmp_stage2_scope_ad_campaigns on public.gmp_ad_campaigns;
create trigger gmp_stage2_scope_ad_campaigns before insert or update on public.gmp_ad_campaigns for each row execute function public.gmp_stage2_validate_reference_scope();
drop trigger if exists gmp_stage2_scope_ad_creatives on public.gmp_ad_creatives;
create trigger gmp_stage2_scope_ad_creatives before insert or update on public.gmp_ad_creatives for each row execute function public.gmp_stage2_validate_reference_scope();
drop trigger if exists gmp_stage2_scope_ad_placements on public.gmp_ad_placements;
create trigger gmp_stage2_scope_ad_placements before insert or update on public.gmp_ad_placements for each row execute function public.gmp_stage2_validate_reference_scope();

revoke execute on function public.gmp_stage2_validate_reference_scope() from public, anon, authenticated;
grant execute on function public.gmp_stage2_validate_reference_scope() to service_role;
