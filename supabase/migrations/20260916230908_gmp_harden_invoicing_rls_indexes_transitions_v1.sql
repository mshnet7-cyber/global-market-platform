-- Harden e-invoicing/compliance performance and enforce workflow transitions at the DB boundary.
create index if not exists gmp_country_invoice_profiles_connector_idx on public.gmp_country_invoice_profiles (connector_id);
create index if not exists gmp_country_invoice_profiles_created_by_idx on public.gmp_country_invoice_profiles (created_by);
create index if not exists gmp_country_invoice_profiles_store_idx on public.gmp_country_invoice_profiles (store_id);
create index if not exists gmp_einvoice_submissions_connector_idx on public.gmp_einvoice_submissions (connector_id);
create index if not exists gmp_einvoice_submissions_created_by_idx on public.gmp_einvoice_submissions (created_by);
create index if not exists gmp_einvoice_submissions_store_idx on public.gmp_einvoice_submissions (store_id);

drop policy if exists gmp_country_invoice_profiles_admin_delete on public.gmp_country_invoice_profiles;
drop policy if exists gmp_country_invoice_profiles_admin_insert on public.gmp_country_invoice_profiles;
drop policy if exists gmp_country_invoice_profiles_admin_update on public.gmp_country_invoice_profiles;
drop policy if exists gmp_country_invoice_profiles_member_read on public.gmp_country_invoice_profiles;
create policy gmp_country_invoice_profiles_admin_delete on public.gmp_country_invoice_profiles for delete using (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_country_invoice_profiles.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'admin'::text])));
create policy gmp_country_invoice_profiles_admin_insert on public.gmp_country_invoice_profiles for insert with check (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_country_invoice_profiles.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'admin'::text])));
create policy gmp_country_invoice_profiles_admin_update on public.gmp_country_invoice_profiles for update using (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_country_invoice_profiles.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'admin'::text]))) with check (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_country_invoice_profiles.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'admin'::text])));
create policy gmp_country_invoice_profiles_member_read on public.gmp_country_invoice_profiles for select using (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_country_invoice_profiles.organization_id and m.user_id = (select auth.uid())));

drop policy if exists gmp_einvoice_submissions_admin_insert on public.gmp_einvoice_submissions;
drop policy if exists gmp_einvoice_submissions_admin_update on public.gmp_einvoice_submissions;
drop policy if exists gmp_einvoice_submissions_member_read on public.gmp_einvoice_submissions;
create policy gmp_einvoice_submissions_admin_insert on public.gmp_einvoice_submissions for insert with check (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_einvoice_submissions.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'admin'::text])));
create policy gmp_einvoice_submissions_admin_update on public.gmp_einvoice_submissions for update using (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_einvoice_submissions.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'admin'::text]))) with check (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_einvoice_submissions.organization_id and m.user_id = (select auth.uid()) and m.role = any (array['owner'::text,'admin'::text])));
create policy gmp_einvoice_submissions_member_read on public.gmp_einvoice_submissions for select using (exists (select 1 from public.gmp_organization_members m where m.organization_id = gmp_einvoice_submissions.organization_id and m.user_id = (select auth.uid())));

create or replace function public.gmp_enforce_einvoice_submission_transition()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not ((old.status = 'queued' and new.status in ('sending','cancelled')) or (old.status = 'sending' and new.status in ('submitted','accepted','rejected','failed')) or (old.status = 'submitted' and new.status in ('accepted','rejected','failed')) or (old.status in ('failed','rejected') and new.status = 'queued')) then
      raise exception 'invalid_einvoice_status_transition: % -> %', old.status, new.status using errcode = '22023';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists gmp_einvoice_submission_status_transition on public.gmp_einvoice_submissions;
create trigger gmp_einvoice_submission_status_transition before update of status on public.gmp_einvoice_submissions for each row execute function public.gmp_enforce_einvoice_submission_transition();

create or replace function public.gmp_enforce_compliance_case_transition()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not ((old.status = 'open' and new.status in ('under_review','closed')) or (old.status = 'under_review' and new.status in ('submitted','accepted','rejected','failed','closed')) or (old.status = 'submitted' and new.status in ('accepted','rejected','failed')) or (old.status = 'failed' and new.status in ('under_review','submitted')) or (old.status = 'rejected' and new.status in ('under_review','closed')) or (old.status = 'accepted' and new.status = 'closed')) then
      raise exception 'invalid_compliance_case_status_transition: % -> %', old.status, new.status using errcode = '22023';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists gmp_compliance_case_status_transition on public.gmp_compliance_cases;
create trigger gmp_compliance_case_status_transition before update of status on public.gmp_compliance_cases for each row execute function public.gmp_enforce_compliance_case_transition();
