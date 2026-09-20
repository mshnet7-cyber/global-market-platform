-- Preview-only demo access must not depend on a server-only Supabase secret.
-- Scope all demo RLS access to the single seeded Global Market demo tenant.
do $$
begin
  execute 'drop policy if exists gmp_demo_preview_org_read on public.gmp_organizations';
  execute 'drop policy if exists gmp_demo_preview_store_read on public.gmp_stores';
  execute 'drop policy if exists gmp_demo_preview_branch_read on public.gmp_branches';
  execute 'drop policy if exists gmp_demo_preview_member_read on public.gmp_organization_members';
  execute 'drop policy if exists gmp_demo_preview_screen_read on public.gmp_screens';
  execute 'drop policy if exists gmp_demo_preview_campaign_read on public.gmp_ad_campaigns';
  execute 'drop policy if exists gmp_demo_preview_campaign_update on public.gmp_ad_campaigns';
  execute 'drop policy if exists gmp_demo_preview_provider_read on public.gmp_data_providers';
  execute 'drop policy if exists gmp_demo_preview_alert_read on public.gmp_market_alert_rules';
  execute 'drop policy if exists gmp_demo_preview_audit_read on public.gmp_audit_logs';
  execute 'drop policy if exists gmp_demo_preview_subscription_read on public.gmp_subscriptions';
end $$;

create policy gmp_demo_preview_org_read on public.gmp_organizations for select to anon
using (id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_store_read on public.gmp_stores for select to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_branch_read on public.gmp_branches for select to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_member_read on public.gmp_organization_members for select to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_screen_read on public.gmp_screens for select to anon
using (store_id='34157c9e-d109-41a3-a199-9bf2e2a54624'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_campaign_read on public.gmp_ad_campaigns for select to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_campaign_update on public.gmp_ad_campaigns for update to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin')
with check (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_provider_read on public.gmp_data_providers for select to anon
using (coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_alert_read on public.gmp_market_alert_rules for select to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_audit_read on public.gmp_audit_logs for select to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');

create policy gmp_demo_preview_subscription_read on public.gmp_subscriptions for select to anon
using (organization_id='b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '')='platform_admin');
