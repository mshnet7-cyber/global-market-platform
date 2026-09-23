-- Harden concurrency/idempotency for manufacturing completion, repairs, and purchase receiving.
-- Production-applied on 2026-09-23.

CREATE OR REPLACE FUNCTION public.gmp_complete_manufacturing(p_order_id uuid, p_actual_quantity numeric, p_actual_weight_grams numeric, p_waste_weight_grams numeric, p_labor_cost numeric, p_client_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=auth.uid(); v_order public.gmp_manufacturing_orders%rowtype; v_comp record; v_total numeric:=0; v_component_cost numeric; v_output_cost numeric; v_inventory uuid; v_labor_payable uuid; v_journal uuid; v_in_id uuid; v_out_id uuid;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 select * into v_order from public.gmp_manufacturing_orders where id=p_order_id for update;
 if not found then raise exception 'manufacturing_order_not_found'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=v_order.organization_id and m.user_id=v_actor and m.role in('owner','admin')) then raise exception 'not authorized'; end if;
 if v_order.status='completed' then return jsonb_build_object('success',true,'idempotent',true,'order_id',v_order.id,'journal_entry_id',v_order.journal_entry_id); end if;
 if v_order.status='cancelled' or p_actual_quantity<=0 or p_actual_weight_grams<0 or p_waste_weight_grams<0 or p_labor_cost<0 then raise exception 'invalid_completion'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmp-manufacturing-complete:'||v_order.organization_id::text||':'||trim(p_client_ref),0));
 if p_actual_weight_grams+p_waste_weight_grams>v_order.planned_weight_grams and v_order.planned_weight_grams>0 then raise exception 'output_plus_waste_exceeds_plan'; end if;
 for v_comp in select c.*,p.current_quantity,p.current_weight_grams,p.cost_price from public.gmp_manufacturing_components c join public.gmp_products p on p.id=c.product_id where c.manufacturing_order_id=v_order.id order by c.product_id for update of p loop
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
end; $function$;

CREATE OR REPLACE FUNCTION public.gmp_process_repair(p_repair_id uuid, p_action text, p_store_id uuid, p_payment_method text, p_client_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=(select auth.uid()); v_repair public.gmp_repair_orders%rowtype; v_org uuid;
 v_existing jsonb; v_ledger jsonb; v_ledger_id uuid; v_journal uuid; v_payment uuid; v_sales uuid;
 v_net numeric; v_unit numeric; v_karat numeric;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 select organization_id into v_org from public.gmp_repair_orders where id=p_repair_id;
 if v_org is null then raise exception 'repair_not_found'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=v_org and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
 select * into v_repair from public.gmp_repair_orders where id=p_repair_id for update;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmp-repair-operation:'||v_org::text||':'||trim(p_client_ref),0));
 select response into v_existing from public.gmp_repair_operation_idempotency where organization_id=v_org and client_ref=trim(p_client_ref);
 if v_existing is not null then return jsonb_build_object('success',true,'idempotent',true,'result',v_existing); end if;
 if p_action not in ('receive','ready','deliver') then raise exception 'invalid_repair_action'; end if;
 if p_action='receive' and v_repair.status<>'received' then raise exception 'invalid_repair_status'; end if;
 if p_action='ready' and v_repair.status<>'in_repair' then raise exception 'invalid_repair_status'; end if;
 if p_action='deliver' and v_repair.status<>'ready' then raise exception 'invalid_repair_status'; end if;
 select s.id into v_org from public.gmp_stores s where s.id=p_store_id and s.organization_id=v_repair.organization_id and (v_repair.branch_id is null or s.branch_id=v_repair.branch_id);
 if not found then raise exception 'repair_store_scope_invalid'; end if;
 v_karat:=nullif((regexp_match(trim(coalesce(v_repair.karat,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric;
 if v_karat is null or v_karat<=0 or v_karat>24 then raise exception 'invalid_repair_karat'; end if;
 if p_action='receive' then
   update public.gmp_repair_orders set store_id=p_store_id,status='in_repair',updated_at=now() where id=p_repair_id;
   v_net:=greatest(v_repair.weight_received_grams,0); v_unit:=case when v_net>0 then coalesce(v_repair.amount,0)/v_net else 0 end;
   select public.gmp_post_gold_ledger_entry(v_repair.organization_id,v_repair.branch_id,p_store_id,null,'repair_in','in','repair',p_repair_id,'repair-receive:'||p_repair_id::text,v_karat,v_net,0,v_net,v_unit,0,0,'OMR',jsonb_build_object('repair_no',v_repair.repair_no,'action','receive')) into v_ledger;
   v_ledger_id:=(v_ledger->>'entry_id')::uuid;
   insert into public.gmp_repair_operation_idempotency(organization_id,client_ref,repair_id,action,response,created_by) values(v_repair.organization_id,trim(p_client_ref),p_repair_id,p_action,jsonb_build_object('repair_id',p_repair_id,'action',p_action,'status','in_repair','gold_ledger_entry_id',v_ledger_id),v_actor);
   return jsonb_build_object('success',true,'idempotent',false,'repair_id',p_repair_id,'action',p_action,'status','in_repair','gold_ledger_entry_id',v_ledger_id);
 end if;
 if p_action='ready' then
   update public.gmp_repair_orders set status='ready',ready_at=now(),updated_at=now() where id=p_repair_id;
   insert into public.gmp_repair_operation_idempotency(organization_id,client_ref,repair_id,action,response,created_by) values(v_repair.organization_id,trim(p_client_ref),p_repair_id,p_action,jsonb_build_object('repair_id',p_repair_id,'action',p_action,'status','ready'),v_actor);
   return jsonb_build_object('success',true,'idempotent',false,'repair_id',p_repair_id,'action',p_action,'status','ready');
 end if;
 if p_payment_method not in ('cash','bank','card','wallet','other') then raise exception 'invalid payment method'; end if;
 select a.id into v_payment from public.gmp_accounts a where a.organization_id=v_repair.organization_id and a.system_key=case p_payment_method when 'cash' then 'cash' when 'bank' then 'bank' when 'card' then 'card' when 'wallet' then 'wallet' else 'other' end and a.active limit 1;
 select a.id into v_sales from public.gmp_accounts a where a.organization_id=v_repair.organization_id and a.system_key='sales' and a.active limit 1;
 if v_payment is null or v_sales is null then raise exception 'repair_accounts_missing'; end if;
 update public.gmp_repair_orders set status='delivered',delivered_at=now(),delivered_by=v_actor,updated_at=now() where id=p_repair_id;
 v_net:=greatest(coalesce(v_repair.weight_delivered_grams,v_repair.weight_received_grams),0); v_unit:=case when v_net>0 then coalesce(v_repair.amount,0)/v_net else 0 end;
 select public.gmp_post_gold_ledger_entry(v_repair.organization_id,v_repair.branch_id,p_store_id,null,'repair_out','out','repair',p_repair_id,'repair-deliver:'||p_repair_id::text,v_karat,v_net,0,v_net,v_unit,coalesce(v_repair.amount,0),0,'OMR',jsonb_build_object('repair_no',v_repair.repair_no,'action','deliver')) into v_ledger;
 v_ledger_id:=(v_ledger->>'entry_id')::uuid;
 insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by) values(v_repair.organization_id,v_repair.branch_id,'repair',p_repair_id,'إيراد إصلاح وتسليم',current_date,'posted',v_actor) returning id into v_journal;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_payment,coalesce(v_repair.amount,0),0,'تحصيل إصلاح');
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_sales,0,coalesce(v_repair.amount,0),'إيراد إصلاح');
 insert into public.gmp_repair_operation_idempotency(organization_id,client_ref,repair_id,action,response,created_by) values(v_repair.organization_id,trim(p_client_ref),p_repair_id,p_action,jsonb_build_object('repair_id',p_repair_id,'action',p_action,'status','delivered','gold_ledger_entry_id',v_ledger_id,'journal_entry_id',v_journal),v_actor);
 return jsonb_build_object('success',true,'idempotent',false,'repair_id',p_repair_id,'action',p_action,'status','delivered','gold_ledger_entry_id',v_ledger_id,'journal_entry_id',v_journal);
end; $function$;

CREATE OR REPLACE FUNCTION public.gmp_receive_purchase(p_purchase_id uuid, p_lines jsonb, p_client_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid := (select auth.uid()); v_purchase public.gmp_purchases%rowtype; v_line jsonb;
 v_line_id uuid; v_product uuid; v_qty numeric; v_weight numeric; v_ordered_qty numeric; v_ordered_weight numeric;
 v_unit_cost numeric; v_making numeric; v_vat numeric; v_received_subtotal numeric:=0; v_received_vat numeric:=0;
 v_inventory_account uuid; v_vat_account uuid; v_payables_account uuid; v_journal uuid; v_journal_total numeric; v_new_status text;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'receipt_lines_required'; end if;
 select * into v_purchase from public.gmp_purchases where id=p_purchase_id for update;
 if not found then raise exception 'purchase_not_found'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmp-purchase-receipt:'||v_purchase.organization_id::text||':'||trim(p_client_ref),0));
 select i.response into v_line from public.gmp_purchase_receipt_idempotency i
 where i.organization_id=v_purchase.organization_id and i.client_ref=trim(p_client_ref);
 if v_line is not null then return v_line; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=v_purchase.organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
 if v_purchase.status not in ('draft','approved') then raise exception 'invalid_purchase_status'; end if;
 select id into v_inventory_account from public.gmp_accounts where organization_id=v_purchase.organization_id and system_key='inventory' and active limit 1;
 select id into v_vat_account from public.gmp_accounts where organization_id=v_purchase.organization_id and system_key='vat_receivable' and active limit 1;
 select id into v_payables_account from public.gmp_accounts where organization_id=v_purchase.organization_id and system_key='payables' and active limit 1;
 if v_inventory_account is null or v_payables_account is null then raise exception 'purchase_accounts_missing'; end if;

 for v_line in select value from jsonb_array_elements(p_lines) order by (value->>'purchase_line_id') loop
   v_line_id:=nullif(v_line->>'purchase_line_id','')::uuid;
   v_qty:=nullif(v_line->>'quantity','')::numeric;
   v_weight:=coalesce(nullif(v_line->>'weight_grams','')::numeric,0);
   select product_id,quantity,coalesce(weight_grams,0),unit_cost,making_charge,vat_amount
     into v_product,v_ordered_qty,v_ordered_weight,v_unit_cost,v_making,v_vat
   from public.gmp_purchase_lines where id=v_line_id and purchase_id=p_purchase_id for update;
   if not found then raise exception 'purchase_line_not_found'; end if;
   if v_product is null then raise exception 'purchase_line_requires_product'; end if;
   if not exists(select 1 from public.gmp_products p join public.gmp_stores s on s.id=p.store_id where p.id=v_product and p.store_id=v_purchase.store_id and s.organization_id=v_purchase.organization_id and p.active) then raise exception 'purchase_product_scope_invalid'; end if;
   if v_qty is null or v_qty<=0 or v_qty > v_ordered_qty then raise exception 'invalid_received_quantity'; end if;
   if v_weight<0 or (v_ordered_weight>0 and v_weight>v_ordered_weight) then raise exception 'invalid_received_weight'; end if;
   if exists(select 1 from public.gmp_purchase_lines pl where pl.id=v_line_id and pl.received_quantity+v_qty>pl.quantity) then raise exception 'received_quantity_exceeds_order'; end if;

   update public.gmp_purchase_lines set received_quantity=received_quantity+v_qty,received_weight_grams=received_weight_grams+v_weight,verified_by=v_actor,verified_at=now(),human_verified=true where id=v_line_id;
   update public.gmp_products set current_quantity=current_quantity+v_qty,current_weight_grams=current_weight_grams+v_weight,cost_price=greatest(cost_price,v_unit_cost),updated_at=now() where id=v_product;
   insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by)
   values(v_purchase.organization_id,v_purchase.branch_id,v_purchase.store_id,v_product,'purchase',v_qty,v_weight,v_unit_cost+case when v_ordered_qty>0 then v_making/v_ordered_qty else 0 end,'purchase',p_purchase_id,v_actor);

   v_received_subtotal:=v_received_subtotal+(v_qty*v_unit_cost)+case when v_ordered_qty>0 then (v_making/v_ordered_qty)*v_qty else 0 end;
   v_received_vat:=v_received_vat+case when v_ordered_qty>0 then (v_vat/v_ordered_qty)*v_qty else 0 end;
 end loop;

 if v_received_vat>0 and v_vat_account is null then raise exception 'VAT input account missing'; end if;
 select case when bool_and(received_quantity>=quantity) then 'received' when bool_or(received_quantity>0) then 'approved' else status end into v_new_status from public.gmp_purchase_lines where purchase_id=p_purchase_id;
 v_journal_total:=v_received_subtotal+v_received_vat;

 insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by)
 values(v_purchase.organization_id,v_purchase.branch_id,'purchase_receipt',p_purchase_id,'ترحيل استلام مشتريات',current_date,'posted',v_actor) returning id into v_journal;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_inventory_account,v_received_subtotal,0,'استلام مخزون');
 if v_received_vat>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_vat_account,v_received_vat,0,'ضريبة مدخلات'); end if;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_payables_account,0,v_journal_total,'التزام المورد');
 if abs((select coalesce(sum(debit),0)-coalesce(sum(credit),0) from public.gmp_journal_lines where journal_entry_id=v_journal))>0.0005 then raise exception 'unbalanced purchase receipt'; end if;
 update public.gmp_purchases set status=v_new_status,reviewed_by=v_actor,reviewed_at=now(),updated_at=now() where id=p_purchase_id;
 v_line := jsonb_build_object('success',true,'purchase_id',p_purchase_id,'journal_id',v_journal,'received_subtotal',round(v_received_subtotal,6),'received_vat',round(v_received_vat,6),'received_total',round(v_journal_total,6),'status',v_new_status,'client_ref',p_client_ref);
 insert into public.gmp_purchase_receipt_idempotency(organization_id,client_ref,purchase_id,response,created_by)
 values(v_purchase.organization_id,trim(p_client_ref),p_purchase_id,v_line,v_actor);
 return v_line;
end; $function$;
