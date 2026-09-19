create or replace function public.gmp_claim_einvoice_send(p_submission_id uuid, p_organization_id uuid)
returns table(attempt_id uuid, attempt_no integer, submission_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_attempt_no integer;
begin
  select status into v_status
  from public.gmp_einvoice_submissions
  where id = p_submission_id
    and organization_id = p_organization_id
  for update;
  if not found then raise exception 'submission_not_found'; end if;
  if v_status not in ('queued','failed') then raise exception 'submission_not_sendable'; end if;
  select coalesce(max(e.attempt_no),0) + 1 into v_attempt_no
  from public.gmp_einvoice_attempts e
  where e.submission_id = p_submission_id;
  update public.gmp_einvoice_submissions
  set status='sending', error_code=null, error_message=null, updated_at=now()
  where id=p_submission_id and organization_id=p_organization_id;
  return query
  insert into public.gmp_einvoice_attempts(submission_id,attempt_no,status)
  values(p_submission_id,v_attempt_no,'started')
  returning id,attempt_no,submission_id;
end;
$$;
revoke execute on function public.gmp_claim_einvoice_send(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gmp_claim_einvoice_send(uuid,uuid) to service_role;