create or replace function public.gmp_sync_gold_ledger_from_inventory_movement()
returns trigger language plpgsql set search_path=public as $$
declare v_product public.gmp_products%rowtype; v_karat numeric; v_direction text; v_total_value numeric;
begin
 if new.product_id is null then return new; end if;
 select * into v_product from public.gmp_products where id=new.product_id and store_id=new.store_id limit 1;
 if not found then raise exception 'gold_ledger_product_scope_invalid'; end if;
 v_karat:=nullif((regexp_match(trim(coalesce(v_product.karat,v_product.purity,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric;
 if v_karat is null or v_karat<=0 or v_karat>24 then return new; end if;
 v_direction:=case new.movement_type
  when 'purchase' then 'in' when 'repair_in' then 'in' when 'adjustment_in' then 'in' when 'transfer_in' then 'in' when 'return_in' then 'in' when 'opening_balance' then 'in' when 'person_gold_purchase' then 'in'
  when 'sale' then 'out' when 'repair_out' then 'out' when 'adjustment_out' then 'out' when 'transfer_out' then 'out' when 'return_out' then 'out' else null end;
 if v_direction is null then return new; end if;
 v_total_value:=round(case when coalesce(new.weight_grams,0)>0 then new.weight_grams*coalesce(new.unit_cost,0) else new.quantity*coalesce(new.unit_cost,0) end,6);
 insert into public.gmp_gold_ledger_entries(
 organization_id,branch_id,store_id,product_id,operation_type,direction,reference_type,reference_id,idempotency_key,karat,
 gross_weight_grams,stone_weight_grams,net_weight_grams,unit_value,making_charge,total_value,currency,metadata,created_by)
 values(new.organization_id,new.branch_id,new.store_id,new.product_id,
 case new.movement_type when 'purchase' then 'purchase' when 'sale' then 'sale' when 'repair_in' then 'repair_in' when 'repair_out' then 'repair_out'
 when 'transfer_in' then 'transfer_in' when 'transfer_out' then 'transfer_out' when 'person_gold_purchase' then 'buyback'
 when 'return_in' then 'sale_return' when 'return_out' then 'purchase_return' when 'adjustment_in' then 'adjustment' when 'adjustment_out' then 'adjustment' when 'opening_balance' then 'adjustment' end,
 v_direction,'inventory_movement',new.id,'inventory-movement:'||new.id::text,v_karat,coalesce(new.weight_grams,0),0,coalesce(new.weight_grams,0),coalesce(new.unit_cost,0),coalesce(v_product.making_charge,0),v_total_value,'OMR',
 jsonb_build_object('source','inventory_movement_trigger','movement_type',new.movement_type,'movement_id',new.id,'value_basis',case when coalesce(new.weight_grams,0)>0 then 'weight_x_unit_cost' else 'quantity_x_unit_cost' end),new.created_by)
 on conflict (organization_id,idempotency_key) do nothing;
 return new;
end; $$;