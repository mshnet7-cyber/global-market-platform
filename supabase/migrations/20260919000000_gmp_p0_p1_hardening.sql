-- P0/P1 hardening applied to GMP Supabase.
-- Marketplace: atomic idempotency + public abuse protection.
-- Webhooks: durable retry queue and dead-letter state.
-- Alerts: atomic cooldown claim.
-- Documents: server-side review gate.

create table if not exists public.gmp_public_order_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  window_count integer not null default 0 check(window_count >= 0),
  hour_started_at timestamptz not null,
  hour_count integer not null default 0 check(hour_count >= 0),
  last_seen_at timestamptz not null default now(),
  blocked_until timestamptz
);
alter table public.gmp_public_order_rate_limits enable row level security;
revoke all on public.gmp_public_order_rate_limits from anon, authenticated;
create index if not exists gmp_marketplace_orders_store_id_idempotency_idx on public.gmp_marketplace_orders(store_id,idempotency_key) where idempotency_key is not null;

create or replace function public.gmp_allow_public_marketplace_order(p_key_hash text,p_now timestamptz default now())
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.gmp_public_order_rate_limits%rowtype;
begin
  if p_key_hash is null or length(p_key_hash)<16 then return false; end if;
  insert into public.gmp_public_order_rate_limits(key_hash,window_started_at,window_count,hour_started_at,hour_count,last_seen_at)
  values(p_key_hash,p_now,1,p_now,1,p_now)
  on conflict(key_hash) do update set
    window_started_at=case when public.gmp_public_order_rate_limits.window_started_at<=p_now-interval '1 minute' then p_now else public.gmp_public_order_rate_limits.window_started_at end,
    window_count=case when public.gmp_public_order_rate_limits.window_started_at<=p_now-interval '1 minute' then 1 else public.gmp_public_order_rate_limits.window_count+1 end,
    hour_started_at=case when public.gmp_public_order_rate_limits.hour_started_at<=p_now-interval '1 hour' then p_now else public.gmp_public_order_rate_limits.hour_started_at end,
    hour_count=case when public.gmp_public_order_rate_limits.hour_started_at<=p_now-interval '1 hour' then 1 else public.gmp_public_order_rate_limits.hour_count+1 end,
    last_seen_at=p_now returning * into r;
  if r.window_count>60 or r.hour_count>300 then update public.gmp_public_order_rate_limits set blocked_until=p_now+interval '10 minutes' where key_hash=p_key_hash; end if;
  return r.window_count<=12 and r.hour_count<=60 and (r.blocked_until is null or r.blocked_until<=p_now);
end $$;
revoke all on function public.gmp_allow_public_marketplace_order(text,timestamptz) from public,anon,authenticated;
grant execute on function public.gmp_allow_public_marketplace_order(text,timestamptz) to service_role;

create or replace function public.gmp_claim_market_alert(p_rule_id uuid,p_cooldown_minutes integer,p_now timestamptz default now())
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.gmp_market_alert_rules set last_triggered_at=p_now,updated_at=p_now
  where id=p_rule_id and active=true and (last_triggered_at is null or last_triggered_at<=p_now-(greatest(1,least(p_cooldown_minutes,1440))*interval '1 minute'));
  return found;
end $$;
revoke all on function public.gmp_claim_market_alert(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.gmp_claim_market_alert(uuid,integer,timestamptz) to service_role;

alter table public.gmp_webhook_deliveries add column if not exists next_attempt_at timestamptz;
alter table public.gmp_webhook_deliveries add column if not exists last_attempt_at timestamptz;
alter table public.gmp_webhook_deliveries add column if not exists max_attempts integer not null default 8 check(max_attempts between 1 and 20);
alter table public.gmp_webhook_deliveries add column if not exists dead_lettered boolean not null default false;
alter table public.gmp_webhook_deliveries add column if not exists payload jsonb not null default '{}'::jsonb;
create index if not exists gmp_webhook_deliveries_retry_idx on public.gmp_webhook_deliveries(next_attempt_at) where ok=false and dead_lettered=false;
create table if not exists public.gmp_webhook_events(event_id uuid primary key,organization_id uuid,event_type text not null,payload jsonb not null,created_at timestamptz not null default now());
alter table public.gmp_webhook_events enable row level security;
revoke all on public.gmp_webhook_events from public,anon,authenticated;
create or replace function public.gmp_claim_due_webhook_deliveries(p_limit integer default 25)
returns table(id uuid,endpoint_id uuid,event_id uuid,event_type text,url text,secret_ciphertext text,payload jsonb,attempts integer)
language sql security definer set search_path=public as $$
  with due as (
    select d.id from public.gmp_webhook_deliveries d
    where d.ok=false and d.dead_lettered=false and (d.next_attempt_at is null or d.next_attempt_at<=now()) and d.attempts<d.max_attempts
    order by d.next_attempt_at nulls first,d.created_at for update skip locked limit greatest(1,least(coalesce(p_limit,25),100))
  ) update public.gmp_webhook_deliveries d set last_attempt_at=now() from due where d.id=due.id
  returning d.id,d.endpoint_id,d.event_id,d.event_type,(select e.url from public.gmp_webhook_endpoints e where e.id=d.endpoint_id),(select e.secret_ciphertext from public.gmp_webhook_endpoints e where e.id=d.endpoint_id),d.payload,d.attempts;
$$;
revoke all on function public.gmp_claim_due_webhook_deliveries(integer) from public,anon,authenticated;
grant execute on function public.gmp_claim_due_webhook_deliveries(integer) to service_role;

create or replace function public.gmp_document_review(p_document_id uuid,p_status text,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('approved','rejected') then raise exception 'invalid_review_status'; end if;
  update public.gmp_documents set review_status=p_status,reviewed_by=p_user_id,reviewed_at=now()
  where id=p_document_id and exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_documents.organization_id and m.user_id=p_user_id and m.role in('owner','admin'));
  return found;
end $$;
revoke all on function public.gmp_document_review(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.gmp_document_review(uuid,text,uuid) to service_role;
