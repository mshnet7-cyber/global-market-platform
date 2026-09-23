insert into public.gmp_gold_ledger_entries(
 organization_id,branch_id,store_id,product_id,operation_type,direction,reference_type,reference_id,idempotency_key,karat,
 gross_weight_grams,stone_weight_grams,net_weight_grams,unit_value,making_charge,total_value,currency,metadata,created_by)
select im.organization_id,im.branch_id,im.store_id,im.product_id,'adjustment','in','inventory_movement',im.id,
       'inventory-movement:'||im.id::text,
       nullif((regexp_match(trim(coalesce(p.karat,p.purity,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric,
       coalesce(im.weight_grams,0),0,coalesce(im.weight_grams,0),coalesce(im.unit_cost,0),coalesce(p.making_charge,0),
       round(case when coalesce(im.weight_grams,0)>0 then im.weight_grams*coalesce(im.unit_cost,0) else im.quantity*coalesce(im.unit_cost,0) end,6),
       'OMR',jsonb_build_object('source','gold_reconciliation_backfill','movement_id',im.id,'movement_type',im.movement_type),im.created_by
from public.gmp_inventory_movements im
join public.gmp_products p on p.id=im.product_id and p.store_id=im.store_id
where im.movement_type='opening_balance'
  and nullif((regexp_match(trim(coalesce(p.karat,p.purity,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric between 1 and 24
  and not exists(select 1 from public.gmp_gold_ledger_entries gl where gl.organization_id=im.organization_id and gl.idempotency_key='inventory-movement:'||im.id::text)
on conflict (organization_id,idempotency_key) do nothing;