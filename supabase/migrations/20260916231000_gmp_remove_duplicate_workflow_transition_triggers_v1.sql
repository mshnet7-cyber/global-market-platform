-- Remove the temporary duplicate workflow triggers; the existing gmp_check_* transition triggers are the canonical DB boundary.
drop trigger if exists gmp_einvoice_submission_status_transition on public.gmp_einvoice_submissions;
drop trigger if exists gmp_compliance_case_status_transition on public.gmp_compliance_cases;
drop function if exists public.gmp_enforce_einvoice_submission_transition();
drop function if exists public.gmp_enforce_compliance_case_transition();
