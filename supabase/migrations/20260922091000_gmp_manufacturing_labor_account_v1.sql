insert into public.gmp_accounts(organization_id,code,name,account_type,system_key,active)
select o.id,'2110','Manufacturing Labor Payable','liability','manufacturing_labor_payable',true
from public.gmp_organizations o
where not exists(select 1 from public.gmp_accounts a where a.organization_id=o.id and a.system_key='manufacturing_labor_payable');

create or replace function public.gmp_complete_manufacturing(
 p_order_id uuid,p_actual_quantity numeric,p_actual_weight_grams numeric,p_waste_weight_grams numeric,p_labor_cost numeric,p_client_ref text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_order public.gmp_manufacturing_orders%rowtype; v_comp record; v_total numeric:=0; v_component_cost numeric; v_output_cost numeric; v_inventory uuid; v_labor_payable uuid; v_journal uuid; v_in_id uuid; v_out_id uuid;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 select * into v_order from public.gmp_manufacturing_orders where id=p_order_id for update;
 if not found then raise exception 'manufacturing_order_not_found'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=v_order.organization_id and m.user_id=v_actor and m.role in('owner','admin')) then raise exception 'not authorized'; end if;
 if v_order.status='completed' then return jsonb_build_object('success',true,'idempotent',true,'order_id',v_order.id,'journal_entry_id',v_order.journal_entry_id); end if;
 if v_order.status='cancelled' or p_actual_quantity<=0 or p_actual_weight_grams<0 or p_waste_weight_grams<0 or p_labor_cost<0 then raise exception 'invalid_completion'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 if p_actual_weight_grams+p_waste_weight_grams>v_order.planned_weight_grams and v_order.planned_weight_grams>0 then raise exception 'output_plus_waste_exceeds_plan'; end if;
 for v_comp in select c.*,p.current_quantity,p.current_weight_grams,p.cost_price from public.gmp_manufacturing_components c join public.gmp_products p on p.id=c.product_id where c.manufacturing_order_id=v_order.id for update of p loop
   if v_comp.current_quantity<v_comp.required_quantity then raise exception 'insufficient_component_quantity'; end if;
   if v_comp.required_weight_grams>0 and v_comp.current_weight_grams<v_comp.required_weight_grams then raise exception 'insufficient_component_weight'; end if;
   v_component_cost:=round(v_comp.required_quantity*coalesce(v_comp.cost_price,0),6); v_total:=v_total+v_component_cost;
 end loop;
 v_output_cost:=round(v_total+coalesce(p_labor_cost,0),6);
 select id into v_inventory from public.gmp_accounts where organization_id=v_order.organization_id and system_key='inventory' and active limit 1;
 select id into v_labor_payable from public.gmp_accounts where organization_id=v_order.organization_id and system_key='manufacturing_labor_payable' and active limit 1;
 if v_inventory is null or (p_labor_cost>0 and v_labor_payable is null) then raise exception 'manufacturing_accounts_missing'; end if;
 for v_comp in select c.*,p.cost_price from public.gmp_manufacturing_components c join public.gmp_products p on p.id=c.product_id where c.manufacturing_order_id=v_order.id for update of p loop
   update public.gmp_products set current_quantity=current_quantity-v_comp.required_quantity,current_weight_grams=current_weight_grams-v_comp.required_weight_grams,updated_at=now() where id=v_comp.product_id;
   insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by)
   values(v_order.organization_id,v_order.branch_id,v_order.store_id,v_comp.product_id,'manufacture_out',v_comp.required_quantity,v_comp.required_weight_grams,coalesce(v_comp.cost_price,0),'manufacturing_order',v_order.id,v_actor);
   update public.gmp_manufacturing_components set consumed_quantity=required_quantity,consumed_weight_grams=required_weight_grams where id=v_comp.id;
 end loop;
 update public.gmp_products set current_quantity=current_quantity+p_actual_quantity,current_weight_grams=current_weight_grams+p_actual_weight_grams,cost_price=case when p_actual_quantity>0 then v_output_cost/p_actual_quantity else cost_price end,updated_at=now() where id=v_order.output_product_id;
 insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by)
 values(v_order.organization_id,v_order.branch_id,v_order.store_id,v_order.output_product_id,'manufacture_in',p_actual_quantity,p_actual_weight_grams,case when p_actual_quantity>0 then v_output_cost/p_actual_quantity else 0 end,'manufacturing_order',v_order.id,v_actor);
 select id into v_in_id from public.gmp_gold_ledger_entries where reference_type='inventory_movement' and reference_id=(select im.id from public.gmp_inventory_movements im where im.reference_type='manufacturing_order' and im.reference_id=v_order.id and im.movement_type='manufacture_in' order by created_at desc limit 1) limit 1;
 select id into v_out_id from public.gmp_gold_ledger_entries where reference_type='inventory_movement' and reference_id=(select im.id from public.gmp_inventory_movements im where im.reference_type='manufacturing_order' and im.reference_id=v_order.id and im.movement_type='manufacture_out' order by created_at desc limit 1) limit 1;
 insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by) values(v_order.organization_id,v_order.branch_id,'manufacturing_order',v_order.id,'ترحيل تصنيع',current_date,'posted',v_actor) returning id into v_journal;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_inventory,v_output_cost,0,'إضافة المنتج المصنع للمخزون');
 if v_total>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_inventory,0,v_total,'استهلاك المواد الخام'); end if;
 if p_labor_cost>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_labor_payable,0,p_labor_cost,'تكلفة تصنيع مستحقة'); end if;
 if abs((select coalesce(sum(debit),0)-coalesce(sum(credit),0) from public.gmp_journal_lines where journal_entry_id=v_journal))>0.0005 then raise exception 'unbalanced manufacturing journal'; end if;
 update public.gmp_manufacturing_orders set status='completed',actual_quantity=p_actual_quantity,actual_weight_grams=p_actual_weight_grams,waste_weight_grams=p_waste_weight_grams,labor_cost=p_labor_cost,total_component_cost=v_total,total_cost=v_output_cost,journal_entry_id=v_journal,completed_by=v_actor,completed_at=now() where id=v_order.id;
 return jsonb_build_object('success',true,'idempotent',false,'order_id',v_order.id,'journal_entry_id',v_journal,'component_cost',v_total,'total_cost',v_output_cost,'gold_ledger_in_id',v_in_id,'gold_ledger_out_id',v_out_id);
end; $$;