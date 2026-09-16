create or replace function public.gmp_allow_display_pairing_attempt(p_key_hash text, p_now timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_attempt_count integer;
begin
  if p_key_hash is null or length(p_key_hash) <> 64 then return false; end if;
  insert into public.gmp_display_pairing_rate_limits(key_hash, window_started_at, attempt_count, updated_at)
  values (p_key_hash, p_now, 1, p_now)
  on conflict (key_hash) do update
  set window_started_at = case
        when public.gmp_display_pairing_rate_limits.window_started_at <= excluded.window_started_at - interval '10 minutes' then excluded.window_started_at
        else public.gmp_display_pairing_rate_limits.window_started_at
      end,
      attempt_count = case
        when public.gmp_display_pairing_rate_limits.window_started_at <= excluded.window_started_at - interval '10 minutes' then 1
        else public.gmp_display_pairing_rate_limits.attempt_count + 1
      end,
      updated_at = excluded.updated_at
  returning attempt_count into v_attempt_count;
  return v_attempt_count <= 20;
end;
$$;

revoke all on function public.gmp_allow_display_pairing_attempt(text, timestamptz) from public, anon, authenticated;
grant execute on function public.gmp_allow_display_pairing_attempt(text, timestamptz) to service_role;
