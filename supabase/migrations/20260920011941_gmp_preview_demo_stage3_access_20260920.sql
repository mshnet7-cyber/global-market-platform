-- Preview-only Demo Shop access for Stage 3 data surfaces.
-- Production authentication and provider execution remain unchanged.
grant select, insert, update on table public.gmp_country_invoice_profiles to anon;
drop policy if exists gmp_demo_preview_shop_invoice_profile_all on public.gmp_country_invoice_profiles;
create policy gmp_demo_preview_shop_invoice_profile_all on public.gmp_country_invoice_profiles for all to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
)
with check (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select on table public.gmp_compliance_connectors to anon;
drop policy if exists gmp_demo_preview_shop_connector_read on public.gmp_compliance_connectors;
create policy gmp_demo_preview_shop_connector_read on public.gmp_compliance_connectors for select to anon
using (
  coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
  and country_code in ('OM','SA','AE')
);

grant select, insert, update on table public.gmp_einvoice_submissions to anon;
drop policy if exists gmp_demo_preview_shop_einvoice_submission_all on public.gmp_einvoice_submissions;
create policy gmp_demo_preview_shop_einvoice_submission_all on public.gmp_einvoice_submissions for all to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
)
with check (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select on table public.gmp_einvoice_attempts to anon;
drop policy if exists gmp_demo_preview_shop_einvoice_attempt_read on public.gmp_einvoice_attempts;
create policy gmp_demo_preview_shop_einvoice_attempt_read on public.gmp_einvoice_attempts for select to anon
using (
  exists (select 1 from public.gmp_einvoice_submissions s where s.id = gmp_einvoice_attempts.submission_id and s.organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid)
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select, insert, update on table public.gmp_documents to anon;
drop policy if exists gmp_demo_preview_shop_documents_all on public.gmp_documents;
create policy gmp_demo_preview_shop_documents_all on public.gmp_documents for all to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
)
with check (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select on table public.gmp_ai_jobs to anon;
drop policy if exists gmp_demo_preview_shop_ai_jobs_read on public.gmp_ai_jobs;
create policy gmp_demo_preview_shop_ai_jobs_read on public.gmp_ai_jobs for select to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select on table public.gmp_whatsapp_messages to anon;
drop policy if exists gmp_demo_preview_shop_whatsapp_read on public.gmp_whatsapp_messages;
create policy gmp_demo_preview_shop_whatsapp_read on public.gmp_whatsapp_messages for select to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select, insert, update, delete on table public.gmp_cameras to anon;
drop policy if exists gmp_demo_preview_shop_cameras_all on public.gmp_cameras;
create policy gmp_demo_preview_shop_cameras_all on public.gmp_cameras for all to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
)
with check (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select, insert, update on table public.gmp_compliance_cases to anon;
drop policy if exists gmp_demo_preview_shop_compliance_cases_all on public.gmp_compliance_cases;
create policy gmp_demo_preview_shop_compliance_cases_all on public.gmp_compliance_cases for all to anon
using (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
)
with check (
  organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

grant select, insert on table public.gmp_compliance_events to anon;
drop policy if exists gmp_demo_preview_shop_compliance_events_all on public.gmp_compliance_events;
create policy gmp_demo_preview_shop_compliance_events_all on public.gmp_compliance_events for all to anon
using (
  exists (select 1 from public.gmp_compliance_cases c where c.id = gmp_compliance_events.case_id and c.organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid)
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
)
with check (
  exists (select 1 from public.gmp_compliance_cases c where c.id = gmp_compliance_events.case_id and c.organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid)
  and coalesce((nullif((select current_setting('request.headers', true)), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);
