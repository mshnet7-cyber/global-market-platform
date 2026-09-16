-- Keep the rate-limit table inaccessible to client roles while allowing server-side service-role access.
-- service_role bypasses RLS; authenticated receives an explicit deny policy so the table is not left policy-less.
create policy gmp_display_pairing_rate_limits_deny_authenticated
  on public.gmp_display_pairing_rate_limits
  for all
  to authenticated
  using (false)
  with check (false);
