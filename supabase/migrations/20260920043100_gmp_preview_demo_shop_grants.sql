grant select, insert, update, delete on table
public.gmp_member_permissions,
public.gmp_customers,
public.gmp_suppliers,
public.gmp_sales,
public.gmp_purchases,
public.gmp_expenses,
public.gmp_repair_orders,
public.gmp_person_gold_purchases,
public.gmp_accounts,
public.gmp_journal_entries,
public.gmp_marketplace_listings,
public.gmp_marketplace_orders,
public.gmp_display_content,
public.gmp_display_schedules,
public.gmp_ad_creatives,
public.gmp_ad_placements,
public.gmp_products
to anon;

grant select on table public.gmp_organization_members to anon;

drop policy if exists gmp_demo_preview_shop_member_read on public.gmp_organization_members;
create policy gmp_demo_preview_shop_member_read on public.gmp_organization_members for select to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select on table public.gmp_organizations, public.gmp_stores, public.gmp_branches, public.gmp_screens, public.gmp_plans, public.gmp_subscriptions to anon;
