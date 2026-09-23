-- Deterministic shop-price calculation layer.
-- Market price remains the source; this function applies tenant-owned rules only.
create or replace function public.gmp_calculate_gold_shop_price(
  p_organization_id uuid,
  p_store_id uuid,
  p_karat numeric,
  p_market_price_24k_per_gram numeric,
  p_side text,
  p_weight_grams numeric default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_rule public.gmp_gold_price_rules%rowtype;
  v_base numeric;
  v_price numeric;
  v_making numeric;
  v_rule_scope text;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id and m.user_id=v_actor
  ) then raise exception 'not authorized'; end if;
  if not exists (
    select 1 from public.gmp_stores s
    where s.id=p_store_id and s.organization_id=p_organization_id
  ) then raise exception 'store not found'; end if;
  if p_karat <= 0 or p_karat > 24 then raise exception 'invalid_karat'; end if;
  if p_market_price_24k_per_gram < 0 then raise exception 'invalid_market_price'; end if;
  if p_weight_grams < 0 then raise exception 'invalid_weight'; end if;
  if p_side not in ('buy','sell') then raise exception 'invalid_side'; end if;

  v_base := p_market_price_24k_per_gram * (p_karat / 24.0);

  select r.* into v_rule
  from public.gmp_gold_price_rules r
  where r.organization_id=p_organization_id
    and r.karat=p_karat
    and r.side=p_side
    and r.active=true
    and r.effective_from <= now()
    and (r.effective_to is null or r.effective_to >= now())
    and (r.store_id=p_store_id or r.store_id is null)
  order by case when r.store_id=p_store_id then 0 else 1 end,
           r.priority asc,
           r.effective_from desc,
           r.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'success',true,
      'market_price_24k_per_gram',round(p_market_price_24k_per_gram,6),
      'karat',p_karat,
      'base_price_per_gram',round(v_base,6),
      'shop_price_per_gram',round(v_base,3),
      'making_charge_total',0,
      'rule_applied',false
    );
  end if;

  v_rule_scope := case when v_rule.store_id=p_store_id then 'store' else 'organization' end;

  v_price := case v_rule.adjustment_type
    when 'percentage' then v_base * (1 + v_rule.adjustment_value / 100.0)
    else v_base + v_rule.adjustment_value
  end;

  if p_side='sell' then
    v_price := greatest(v_price, v_base + v_rule.min_margin_per_gram);
  end if;

  v_price := round(v_price, v_rule.rounding_scale);
  v_making := round(coalesce(v_rule.making_charge_per_gram,0) * p_weight_grams, v_rule.rounding_scale);

  return jsonb_build_object(
    'success',true,
    'market_price_24k_per_gram',round(p_market_price_24k_per_gram,6),
    'karat',p_karat,
    'base_price_per_gram',round(v_base,6),
    'shop_price_per_gram',v_price,
    'making_charge_per_gram',round(coalesce(v_rule.making_charge_per_gram,0),6),
    'making_charge_total',v_making,
    'rule_applied',true,
    'rule_id',v_rule.id,
    'rule_scope',v_rule_scope,
    'side',p_side,
    'rounding_scale',v_rule.rounding_scale
  );
end;
$$;

revoke all on function public.gmp_calculate_gold_shop_price(uuid,uuid,numeric,numeric,text,numeric) from public,anon;
grant execute on function public.gmp_calculate_gold_shop_price(uuid,uuid,numeric,numeric,text,numeric) to authenticated;