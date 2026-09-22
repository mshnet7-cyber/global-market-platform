-- Stage 1 security hardening: keep the API rate bucket internal and
-- ensure the rate-limit RPC is callable only by trusted server-side roles.
revoke execute on function public.gmp_consume_api_rate_limit(uuid,integer,integer) from anon, authenticated;
grant execute on function public.gmp_consume_api_rate_limit(uuid,integer,integer) to service_role;

drop policy if exists gmp_api_rate_buckets_deny_client on public.gmp_api_rate_buckets;
create policy gmp_api_rate_buckets_deny_client
on public.gmp_api_rate_buckets
for all
to anon, authenticated
using (false)
with check (false);

create index if not exists gmp_market_alert_rules_organization_idx
on public.gmp_market_alert_rules(organization_id,created_at desc);
