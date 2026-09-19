create or replace function public.gmp_claim_due_whatsapp_messages(p_limit integer default 25)
returns setof public.gmp_whatsapp_messages
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.gmp_whatsapp_messages
    where status in ('failed','queued')
      and attempts < 8
      and (next_retry_at is null or next_retry_at <= now())
      and (status = 'failed' or created_at <= now() - interval '5 minutes')
    order by coalesce(next_retry_at, created_at), created_at
    limit greatest(1, least(coalesce(p_limit,25),100))
    for update skip locked
  )
  update public.gmp_whatsapp_messages m
  set next_retry_at = now() + interval '5 minutes',
      updated_at = now()
  from due
  where m.id = due.id
  returning m.*;
end;
$$;

revoke execute on function public.gmp_claim_due_whatsapp_messages(integer) from public,anon,authenticated;
grant execute on function public.gmp_claim_due_whatsapp_messages(integer) to service_role;
