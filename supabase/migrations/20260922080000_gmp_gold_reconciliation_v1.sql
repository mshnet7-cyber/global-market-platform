create or replace view public.gmp_gold_reconciliation as
with inv as (
 select organization_id,store_id,product_id,
        sum(case when movement_type in ('purchase','repair_in','transfer_in','return_in','opening_balance','person_gold_purchase','exchange_in','adjustment_in') then weight_grams
                 when movement_type in ('sale','repair_out','transfer_out','return_out','exchange_out','adjustment_out') then -weight_grams else 0 end) inventory_weight_grams,
        sum(case when movement_type in ('purchase','repair_in','transfer_in','return_in','opening_balance','person_gold_purchase','exchange_in','adjustment_in') then coalesce(weight_grams,0)*coalesce(unit_cost,0)
                 when movement_type in ('sale','repair_out','transfer_out','return_out','exchange_out','adjustment_out') then -coalesce(weight_grams,0)*coalesce(unit_cost,0) else 0 end) movement_value
 from public.gmp_inventory_movements group by organization_id,store_id,product_id
), ledger as (
 select organization_id,store_id,product_id,sum(case when direction='in' then net_weight_grams when direction='out' then -net_weight_grams else 0 end) ledger_weight_grams,
        sum(case when direction='in' then total_value when direction='out' then -total_value else 0 end) ledger_value
 from public.gmp_gold_ledger_entries group by organization_id,store_id,product_id
)
select p.store_id,p.id product_id,p.name,p.karat,p.current_weight_grams,
       coalesce(i.inventory_weight_grams,0) movement_weight_grams,
       coalesce(l.ledger_weight_grams,0) ledger_weight_grams,
       round(p.current_weight_grams-coalesce(i.inventory_weight_grams,0),6) inventory_movement_delta,
       round(coalesce(i.inventory_weight_grams,0)-coalesce(l.ledger_weight_grams,0),6) inventory_ledger_delta,
       round(coalesce(i.movement_value,0)-coalesce(l.ledger_value,0),6) value_delta,
       (abs(p.current_weight_grams-coalesce(i.inventory_weight_grams,0))<=0.0005 and abs(coalesce(i.inventory_weight_grams,0)-coalesce(l.ledger_weight_grams,0))<=0.0005) reconciled
from public.gmp_products p left join inv i on i.organization_id=(select organization_id from public.gmp_stores s where s.id=p.store_id) and i.store_id=p.store_id and i.product_id=p.id
left join ledger l on l.organization_id=(select organization_id from public.gmp_stores s where s.id=p.store_id) and l.store_id=p.store_id and l.product_id=p.id;
create index if not exists gmp_inventory_movements_reconciliation_idx on public.gmp_inventory_movements(store_id,product_id,movement_type);
create index if not exists gmp_gold_ledger_reconciliation_idx on public.gmp_gold_ledger_entries(store_id,product_id,direction);
