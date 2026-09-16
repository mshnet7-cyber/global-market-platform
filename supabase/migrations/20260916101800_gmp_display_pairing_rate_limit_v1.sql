create table if not exists public.gmp_display_pairing_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count >= 0),
  updated_at timestamptz not null default now()
);

revoke all on table public.gmp_display_pairing_rate_limits from public, anon, authenticated;

drop function if exists public.gmp_allow_display_pairing_attempt(text, timestamptz);
create or replace function public.gmp_allow_display_pairing_attempt(p_key_hash text, p_now timestamptz default now())
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.gmp_display_pairing_rate_limits;
begin
  if p_key_hash is null or length(p_key_hash) <> 64 then
    return false;
  end if;

  insert into public.gmp_display_pairing_rate_limits(key_hash, window_started_at, attempt_count, updated_at)
  values (p_key_hash, p_now, 1, p_now)
  on conflict (key_hash) do nothing;

  select * into v_row
  from public.gmp_display_pairing_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_row.window_started_at <= p_now - interval '10 minutes' then
    update public.gmp_display_pairing_rate_limits
    set window_started_at = p_now, attempt_count = 1, updated_at = p_now
    where key_hash = p_key_hash;
    return true;
  end if;

  if v_row.attempt_count >= 20 then
    update public.gmp_display_pairing_rate_limits set updated_at = p_now where key_hash = p_key_hash;
    return false;
  end if;

  update public.gmp_display_pairing_rate_limits
  set attempt_count = attempt_count + 1, updated_at = p_now
  where key_hash = p_key_hash;
  return true;
end;
$$;

revoke all on function public.gmp_allow_display_pairing_attempt(text, timestamptz) from public, anon, authenticated;
grant execute on function public.gmp_allow_display_pairing_attempt(text, timestamptz) to service_role;

create index if not exists gmp_display_pairing_rate_limits_updated_idx
  on public.gmp_display_pairing_rate_limits(updated_at);
