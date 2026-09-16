CREATE OR REPLACE FUNCTION public.gmp_adjust_inventory(
  p_organization_id uuid,
  p_product_id uuid,
  p_quantity_delta numeric,
  p_weight_delta numeric,
  p_unit_cost numeric,
  p_movement_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
declare
  v_actor uuid := (select auth.uid());
  v_store uuid;
  v_branch uuid;
  v_q numeric;
  v_w numeric;
  v_type text;
  v_requested text := lower(trim(coalesce(p_movement_type,'')));
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
  if p_quantity_delta is null or p_weight_delta is null or p_unit_cost is null or p_unit_cost<0 then raise exception 'invalid_inventory_adjustment'; end if;
  if p_quantity_delta=0 and p_weight_delta=0 then raise exception 'zero_inventory_adjustment'; end if;
  if (p_quantity_delta>0 and p_weight_delta<0) or (p_quantity_delta<0 and p_weight_delta>0) then raise exception 'inventory_delta_direction_mismatch'; end if;

  select s.id,s.branch_id,p.current_quantity,p.current_weight_grams
  into v_store,v_branch,v_q,v_w
  from public.gmp_products p
  join public.gmp_stores s on s.id=p.store_id
  where p.id=p_product_id and s.organization_id=p_organization_id and p.active=true
  for update;
  if not found then raise exception 'product_not_found'; end if;
  if v_q+p_quantity_delta<0 or v_w+p_weight_delta<0 then raise exception 'inventory_would_be_negative'; end if;

  v_type := case
    when v_requested in ('adjustment_in','adjustment_out') then v_requested
    when p_quantity_delta>0 or p_weight_delta>0 then 'adjustment_in'
    else 'adjustment_out'
  end;
  if v_type='adjustment_in' and (p_quantity_delta<0 or p_weight_delta<0) then raise exception 'movement_direction_mismatch'; end if;
  if v_type='adjustment_out' and (p_quantity_delta>0 or p_weight_delta>0) then raise exception 'movement_direction_mismatch'; end if;

  update public.gmp_products
  set current_quantity=v_q+p_quantity_delta,current_weight_grams=v_w+p_weight_delta,updated_at=now()
  where id=p_product_id;

  insert into public.gmp_inventory_movements(
    organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,created_by
  ) values(
    p_organization_id,v_branch,v_store,p_product_id,v_type,abs(p_quantity_delta),abs(p_weight_delta),p_unit_cost,'manual_adjustment',v_actor
  );

  return jsonb_build_object('success',true,'movement_type',v_type,'current_quantity',v_q+p_quantity_delta,'current_weight_grams',v_w+p_weight_delta);
end;
$$;

REVOKE ALL ON FUNCTION public.gmp_adjust_inventory(uuid,uuid,numeric,numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gmp_adjust_inventory(uuid,uuid,numeric,numeric,numeric,text) TO authenticated;
