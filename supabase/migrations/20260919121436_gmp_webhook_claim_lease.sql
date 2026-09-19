create or replace function public.gmp_claim_due_webhook_deliveries(p_limit integer default 25)
returns table(id uuid,endpoint_id uuid,event_id uuid,event_type text,url text,secret_ciphertext text,payload jsonb,attempts integer)
language sql security definer set search_path=public as $$
  with due as (
    select d.id
    from public.gmp_webhook_deliveries d
    where d.ok=false
      and d.dead_lettered=false
      and (d.next_attempt_at is null or d.next_attempt_at<=now())
      and d.attempts<d.max_attempts
    order by d.next_attempt_at nulls first,d.created_at
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,25),100))
  )
  update public.gmp_webhook_deliveries d
  set last_attempt_at=now(),
      next_attempt_at=now()+interval '5 minutes'
  from due
  where d.id=due.id
  returning d.id,d.endpoint_id,d.event_id,d.event_type,
    (select e.url from public.gmp_webhook_endpoints e where e.id=d.endpoint_id),
    (select e.secret_ciphertext from public.gmp_webhook_endpoints e where e.id=d.endpoint_id),
    d.payload,d.attempts;
$$;
revoke all on function public.gmp_claim_due_webhook_deliveries(integer) from public,anon,authenticated;
grant execute on function public.gmp_claim_due_webhook_deliveries(integer) to service_role;
