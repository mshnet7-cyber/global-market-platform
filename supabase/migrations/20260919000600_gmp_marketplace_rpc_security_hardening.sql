-- Security follow-up: public Marketplace behavior is exposed only through the rate-limited Next.js route.
revoke execute on function public.gmp_create_marketplace_order(uuid,text,text,text,text,jsonb,text,text) from anon,authenticated;
create policy gmp_public_order_rate_limits_deny on public.gmp_public_order_rate_limits for all to anon,authenticated using(false) with check(false);
create policy gmp_webhook_events_deny on public.gmp_webhook_events for all to anon,authenticated using(false) with check(false);
