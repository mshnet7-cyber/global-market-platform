alter table public.gmp_cameras add column if not exists stream_url text;
alter table public.gmp_cameras add column if not exists stream_kind text;
alter table public.gmp_cameras add column if not exists last_error text;
alter table public.gmp_cameras drop constraint if exists gmp_cameras_stream_kind_check;
alter table public.gmp_cameras add constraint gmp_cameras_stream_kind_check check (stream_kind is null or stream_kind = any (array['hls','http','https','mp4','webrtc']::text[]));
create index if not exists gmp_cameras_org_enabled_idx on public.gmp_cameras(organization_id, enabled, status);

create table if not exists public.gmp_country_invoice_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  store_id uuid references public.gmp_stores(id) on delete set null,
  country_code text not null,
  legal_name text,
  tax_number text,
  registration_number text,
  currency text,
  vat_rate numeric not null default 0 check (vat_rate >= 0 and vat_rate <= 100),
  e_invoice_enabled boolean not null default false,
  connector_id uuid references public.gmp_compliance_connectors(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, store_id, country_code)
);
create index if not exists gmp_country_invoice_profiles_org_idx on public.gmp_country_invoice_profiles(organization_id, country_code);

create table if not exists public.gmp_einvoice_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  store_id uuid references public.gmp_stores(id) on delete set null,
  sale_id uuid references public.gmp_sales(id) on delete set null,
  connector_id uuid references public.gmp_compliance_connectors(id) on delete set null,
  country_code text not null,
  status text not null default 'queued' check (status = any (array['queued','sending','submitted','accepted','rejected','failed','cancelled']::text[])),
  idempotency_key text not null,
  request_hash text,
  external_reference text,
  error_code text,
  error_message text,
  submitted_at timestamptz,
  response_received_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id, idempotency_key)
);
create index if not exists gmp_einvoice_submissions_org_created_idx on public.gmp_einvoice_submissions(organization_id, created_at desc);
create index if not exists gmp_einvoice_submissions_sale_idx on public.gmp_einvoice_submissions(sale_id);

create or replace function public.gmp_set_updated_at() returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists gmp_country_invoice_profiles_updated_at on public.gmp_country_invoice_profiles;
create trigger gmp_country_invoice_profiles_updated_at before update on public.gmp_country_invoice_profiles for each row execute function public.gmp_set_updated_at();
drop trigger if exists gmp_einvoice_submissions_updated_at on public.gmp_einvoice_submissions;
create trigger gmp_einvoice_submissions_updated_at before update on public.gmp_einvoice_submissions for each row execute function public.gmp_set_updated_at();

alter table public.gmp_country_invoice_profiles enable row level security;
alter table public.gmp_einvoice_submissions enable row level security;

do $$ begin
if not exists (select 1 from pg_policies where schemaname='public' and tablename='gmp_country_invoice_profiles' and policyname='gmp_country_invoice_profiles_member_read') then create policy gmp_country_invoice_profiles_member_read on public.gmp_country_invoice_profiles for select to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_country_invoice_profiles.organization_id and m.user_id=auth.uid())); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='gmp_country_invoice_profiles' and policyname='gmp_country_invoice_profiles_admin_insert') then create policy gmp_country_invoice_profiles_admin_insert on public.gmp_country_invoice_profiles for insert to authenticated with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_country_invoice_profiles.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='gmp_country_invoice_profiles' and policyname='gmp_country_invoice_profiles_admin_update') then create policy gmp_country_invoice_profiles_admin_update on public.gmp_country_invoice_profiles for update to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_country_invoice_profiles.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))) with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_country_invoice_profiles.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='gmp_country_invoice_profiles' and policyname='gmp_country_invoice_profiles_admin_delete') then create policy gmp_country_invoice_profiles_admin_delete on public.gmp_country_invoice_profiles for delete to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_country_invoice_profiles.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='gmp_einvoice_submissions' and policyname='gmp_einvoice_submissions_member_read') then create policy gmp_einvoice_submissions_member_read on public.gmp_einvoice_submissions for select to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_einvoice_submissions.organization_id and m.user_id=auth.uid())); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='gmp_einvoice_submissions' and policyname='gmp_einvoice_submissions_admin_insert') then create policy gmp_einvoice_submissions_admin_insert on public.gmp_einvoice_submissions for insert to authenticated with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_einvoice_submissions.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))); end if;
if not exists (select 1 from pg_policies where schemaname='public' and tablename='gmp_einvoice_submissions' and policyname='gmp_einvoice_submissions_admin_update') then create policy gmp_einvoice_submissions_admin_update on public.gmp_einvoice_submissions for update to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_einvoice_submissions.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))) with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_einvoice_submissions.organization_id and m.user_id=auth.uid() and m.role in ('owner','admin'))); end if;
end $$;