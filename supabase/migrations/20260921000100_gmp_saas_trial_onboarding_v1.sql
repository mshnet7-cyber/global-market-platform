-- SaaS onboarding: provision a selected 7-day trial subscription during account bootstrap.
-- The bootstrap RPC is server-only; the application passes the selected plan after validating it.

drop function if exists public.gmp_bootstrap_account(uuid,text,text,text,text,text,text);

create or replace function public.gmp_bootstrap_account(
  p_user_id uuid,
  p_name text,
  p_country_code text,
  p_currency text,
  p_timezone text,
  p_org_slug text,
  p_store_slug text,
  p_plan_code text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_org_id uuid;
  v_store_id uuid;
  v_plan_id uuid;
  v_plan_code text := lower(trim(coalesce(p_plan_code, 'starter')));
  v_now timestamptz := now();
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_user_id is null then raise exception 'user_id_required'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then raise exception 'user_not_found'; end if;
  if coalesce(trim(p_org_slug), '') = '' or coalesce(trim(p_store_slug), '') = '' then raise exception 'slug_required'; end if;
  if v_plan_code not in ('starter','pro','business') then raise exception 'invalid_plan'; end if;

  select id into v_plan_id from public.gmp_plans where code = v_plan_code limit 1;
  if v_plan_id is null then raise exception 'plan_not_found'; end if;

  insert into public.gmp_organizations (name, slug, owner_id)
  values (trim(p_name), trim(p_org_slug), p_user_id)
  returning id into v_org_id;
  insert into public.gmp_profiles (id, display_name)
  values (p_user_id, trim(p_name))
  on conflict (id) do update set display_name = excluded.display_name;
  insert into public.gmp_organization_members (organization_id, user_id, role)
  values (v_org_id, p_user_id, 'owner')
  on conflict (organization_id, user_id) do update set role = excluded.role;
  insert into public.gmp_stores (organization_id, name, slug, country_code, currency, timezone)
  values (v_org_id, trim(p_name), trim(p_store_slug), upper(trim(p_country_code)), upper(trim(p_currency)), trim(p_timezone))
  returning id into v_store_id;
  insert into public.gmp_store_settings (store_id) values (v_store_id);
  insert into public.gmp_subscriptions (
    organization_id, plan_id, status, provider, external_id,
    current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
  ) values (
    v_org_id, v_plan_id, 'trialing', 'platform_trial',
    'trial-' || replace(v_org_id::text, '-', ''),
    v_now, v_now + interval '7 days', false, v_now, v_now
  );

  return jsonb_build_object('organization_id', v_org_id, 'store_id', v_store_id, 'plan_code', v_plan_code, 'trial_days', 7, 'trial_ends_at', v_now + interval '7 days');
end;
$$;

revoke execute on function public.gmp_bootstrap_account(uuid,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.gmp_bootstrap_account(uuid,text,text,text,text,text,text,text) to service_role;
