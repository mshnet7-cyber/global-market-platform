-- Keep SaaS store provisioning consistent with merchant-access trial semantics.
-- A valid 7-day trial is entitled to the plan's configured store limit.

create or replace function public.gmp_create_store(
  p_org_id uuid,
  p_name text,
  p_country_code text,
  p_currency text,
  p_timezone text,
  p_base_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_count integer;
  v_sub record;
  v_max integer;
  v_slug text;
  v_store_id uuid;
  v_base text;
  v_idx integer := 1;
  v_now timestamptz := now();
begin
  if p_org_id is null or coalesce(trim(p_name), '') = '' or coalesce(trim(p_base_slug), '') = '' then
    raise exception using errcode = '22023', message = 'invalid_store_input';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text, 0));

  select count(*)::integer into v_count
  from public.gmp_stores
  where organization_id = p_org_id;

  select s.status, s.plan_id, s.current_period_end
    into v_sub
  from public.gmp_subscriptions s
  where s.organization_id = p_org_id
  order by s.created_at desc
  limit 1;

  if v_count > 0 and (
    v_sub is null
    or v_sub.status not in ('active','trialing','grace_period')
    or (v_sub.current_period_end is not null and v_sub.current_period_end <= v_now)
  ) then
    raise exception using errcode = '42501', message = 'subscription_required';
  end if;

  if v_count > 0 and v_sub is not null
     and v_sub.status in ('active','trialing','grace_period')
     and (v_sub.current_period_end is null or v_sub.current_period_end > v_now) then
    select e.max_stores into v_max
    from public.gmp_plan_entitlements e
    where e.plan_id = v_sub.plan_id
    limit 1;

    if v_max is not null and v_count >= v_max then
      raise exception using errcode = '54000', message = 'store_limit';
    end if;
  end if;

  v_base := left(trim(p_base_slug), 60);
  v_slug := v_base || '-' || lower(trim(p_country_code));

  while exists (select 1 from public.gmp_stores where slug = v_slug) loop
    v_idx := v_idx + 1;
    v_slug := v_base || '-' || lower(trim(p_country_code)) || '-' || v_idx::text;
    if v_idx > 10000 then
      raise exception using errcode = '54000', message = 'slug_generation_failed';
    end if;
  end loop;

  insert into public.gmp_stores(
    organization_id, name, slug, country_code, currency, timezone, created_at, updated_at
  )
  values (
    p_org_id, trim(p_name), v_slug, upper(trim(p_country_code)), upper(trim(p_currency)), trim(p_timezone), v_now, v_now
  )
  returning id into v_store_id;

  insert into public.gmp_store_settings(store_id) values (v_store_id);

  return jsonb_build_object('store_id', v_store_id, 'slug', v_slug);
end;
$function$;

revoke execute on function public.gmp_create_store(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.gmp_create_store(uuid,text,text,text,text,text) to service_role;
