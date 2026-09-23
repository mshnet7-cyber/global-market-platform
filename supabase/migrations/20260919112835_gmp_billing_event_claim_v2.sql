create or replace function public.gmp_claim_billing_event(
  p_organization_id uuid,
  p_subscription_id uuid,
  p_event_key text,
  p_event_type text,
  p_provider text,
  p_payload_hash text
)
returns table(event_id uuid, claimed boolean, current_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
  v_created_at timestamptz;
begin
  if coalesce(length(trim(p_event_key)),0) = 0 or coalesce(length(trim(p_event_type)),0) = 0 or coalesce(length(trim(p_provider)),0) = 0 then
    raise exception 'billing_event_identity_required';
  end if;
  perform 1 from public.gmp_subscriptions
  where id=p_subscription_id and organization_id=p_organization_id
  for update;
  if not found then raise exception 'subscription_not_found'; end if;

  insert into public.gmp_billing_events(
    organization_id,subscription_id,event_key,event_type,payload_hash,provider,status
  ) values(
    p_organization_id,p_subscription_id,left(trim(p_event_key),200),left(trim(p_event_type),160),
    left(coalesce(p_payload_hash,''),64),left(trim(p_provider),80),'received'
  )
  on conflict (provider,event_key) do nothing
  returning id into v_id;

  if v_id is not null then
    return query select v_id,true,'received'::text;
    return;
  end if;

  select id,status,created_at into v_id,v_status,v_created_at
  from public.gmp_billing_events
  where provider=left(trim(p_provider),80)
    and event_key=left(trim(p_event_key),200)
  for update;

  if v_status in ('processed','ignored') then
    return query select v_id,false,v_status;
    return;
  end if;

  if v_status='received' and v_created_at > now()-interval '10 minutes' then
    return query select v_id,false,v_status;
    return;
  end if;

  update public.gmp_billing_events
  set organization_id=p_organization_id,
      subscription_id=p_subscription_id,
      event_type=left(trim(p_event_type),160),
      payload_hash=left(coalesce(p_payload_hash,''),64),
      status='received',
      error_message=null,
      created_at=now()
  where id=v_id;

  return query select v_id,true,'received'::text;
end;
$$;
revoke execute on function public.gmp_claim_billing_event(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gmp_claim_billing_event(uuid,uuid,text,text,text,text) to service_role;