create table if not exists public.gmp_cameras (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  branch_id uuid references public.gmp_branches(id) on delete set null,
  store_id uuid references public.gmp_stores(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 120),
  camera_type text not null default 'ip' check (camera_type in ('ip','nvr','dvr','other')),
  protocol text check (protocol in ('onvif','rtsp','http','https','webrtc','hls','other')),
  endpoint_secret_ref text,
  status text not null default 'unconfigured' check (status in ('unconfigured','online','offline','error','disabled')),
  enabled boolean not null default true,
  last_seen_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gmp_cameras_org_idx on public.gmp_cameras(organization_id);
create index if not exists gmp_cameras_store_idx on public.gmp_cameras(store_id);

create table if not exists public.gmp_compliance_connectors (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  provider_code text not null,
  provider_name text not null,
  integration_mode text not null check (integration_mode in ('government_api','accredited_provider','hybrid','manual')),
  base_url text,
  api_version text,
  status text not null default 'planned' check (status in ('planned','ready','configured','active','disabled')),
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country_code, provider_code)
);

create table if not exists public.gmp_compliance_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  branch_id uuid references public.gmp_branches(id) on delete set null,
  entity_type text not null check (entity_type in ('gold_purchase','sale','customer','repair','other')),
  entity_id uuid,
  case_type text not null default 'review' check (case_type in ('review','suspicious','report','government_submission')),
  status text not null default 'open' check (status in ('open','under_review','submitted','accepted','rejected','closed','failed')),
  government_reference text,
  connector_id uuid references public.gmp_compliance_connectors(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gmp_compliance_cases_org_idx on public.gmp_compliance_cases(organization_id,created_at desc);
create index if not exists gmp_compliance_cases_entity_idx on public.gmp_compliance_cases(entity_type,entity_id);

create table if not exists public.gmp_compliance_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.gmp_compliance_cases(id) on delete cascade,
  direction text not null check (direction in ('outbound','inbound','internal')),
  event_type text not null,
  idempotency_key text,
  external_reference text,
  http_status integer,
  payload_hash text,
  occurred_at timestamptz not null default now(),
  unique(case_id,idempotency_key)
);
create index if not exists gmp_compliance_events_case_idx on public.gmp_compliance_events(case_id,occurred_at desc);

alter table public.gmp_cameras enable row level security;
alter table public.gmp_compliance_cases enable row level security;
alter table public.gmp_compliance_events enable row level security;

drop policy if exists gmp_cameras_admin_insert on public.gmp_cameras;
drop policy if exists gmp_cameras_admin_update on public.gmp_cameras;
drop policy if exists gmp_cameras_admin_delete on public.gmp_cameras;
drop policy if exists gmp_cameras_member_read on public.gmp_cameras;
create policy gmp_cameras_admin_insert on public.gmp_cameras for insert to authenticated with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_cameras.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_cameras_admin_update on public.gmp_cameras for update to authenticated using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_cameras.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_cameras.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_cameras_admin_delete on public.gmp_cameras for delete to authenticated using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_cameras.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_cameras_member_read on public.gmp_cameras for select to authenticated using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_cameras.organization_id and m.user_id=(select auth.uid())));

create policy gmp_compliance_cases_admin_insert on public.gmp_compliance_cases for insert to authenticated with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_compliance_cases.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_compliance_cases_admin_update on public.gmp_compliance_cases for update to authenticated using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_compliance_cases.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_compliance_cases.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_compliance_cases_member_read on public.gmp_compliance_cases for select to authenticated using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_compliance_cases.organization_id and m.user_id=(select auth.uid())));

create policy gmp_compliance_events_admin_insert on public.gmp_compliance_events for insert to authenticated with check (exists (select 1 from public.gmp_compliance_cases c join public.gmp_organization_members m on m.organization_id=c.organization_id where c.id=gmp_compliance_events.case_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
create policy gmp_compliance_events_member_read on public.gmp_compliance_events for select to authenticated using (exists (select 1 from public.gmp_compliance_cases c join public.gmp_organization_members m on m.organization_id=c.organization_id where c.id=gmp_compliance_events.case_id and m.user_id=(select auth.uid())));

insert into public.gmp_compliance_connectors(country_code,provider_code,provider_name,integration_mode,status,capabilities)
values
('OM','oman_einvoice','Oman e-Invoicing','hybrid','planned','{"electronic_invoicing":true,"tax_engine":true,"government_api_ready":true}'),
('SA','zatca_fatoorah','Saudi ZATCA Fatoorah','government_api','planned','{"electronic_invoicing":true,"tax_engine":true,"government_api_ready":true}'),
('AE','uae_einvoice','UAE e-Invoicing','accredited_provider','planned','{"electronic_invoicing":true,"tax_engine":true,"government_api_ready":true}')
on conflict(country_code,provider_code) do nothing;
