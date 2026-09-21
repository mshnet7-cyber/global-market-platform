-- Workshop / Manufacturing foundation: BOM, production orders, atomic completion.
create table if not exists public.gmp_manufacturing_orders(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
 branch_id uuid references public.gmp_branches(id),
 store_id uuid not null references public.gmp_stores(id),
 output_product_id uuid not null references public.gmp_products(id),
 order_no text,
 status text not null default 'planned' check(status in ('planned','in_progress','completed','cancelled')),
 planned_quantity numeric not null check(planned_quantity>0),
 planned_weight_grams numeric not null default 0 check(planned_weight_grams>=0),
 actual_quantity numeric,
 actual_weight_grams numeric,
 waste_weight_grams numeric not null default 0 check(waste_weight_grams>=0),
 labor_cost numeric not null default 0 check(labor_cost>=0),
 total_component_cost numeric,
 total_cost numeric,
 journal_entry_id uuid,
 client_ref text not null,
 created_by uuid references auth.users(id),
 completed_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(organization_id,client_ref)
);
create table if not exists public.gmp_manufacturing_components(
 id uuid primary key default gen_random_uuid(),
 manufacturing_order_id uuid not null references public.gmp_manufacturing_orders(id) on delete cascade,
 product_id uuid not null references public.gmp_products(id),
 required_quantity numeric not null check(required_quantity>0),
 required_weight_grams numeric not null default 0 check(required_weight_grams>=0),
 unit_cost numeric,
 consumed_quantity numeric default 0 check(consumed_quantity>=0),
 consumed_weight_grams numeric default 0 check(consumed_weight_grams>=0),
 created_at timestamptz not null default now(),
 unique(manufacturing_order_id,product_id)
);
alter table public.gmp_manufacturing_orders enable row level security;
alter table public.gmp_manufacturing_components enable row level security;
drop policy if exists gmp_manufacturing_orders_member_read on public.gmp_manufacturing_orders;
create policy gmp_manufacturing_orders_member_read on public.gmp_manufacturing_orders for select to authenticated using(exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_manufacturing_orders.organization_id and m.user_id=auth.uid()));
drop policy if exists gmp_manufacturing_components_member_read on public.gmp_manufacturing_components;
create policy gmp_manufacturing_components_member_read on public.gmp_manufacturing_components for select to authenticated using(exists(select 1 from public.gmp_manufacturing_orders o join public.gmp_organization_members m on m.organization_id=o.organization_id where o.id=gmp_manufacturing_components.manufacturing_order_id and m.user_id=auth.uid()));

alter table public.gmp_inventory_movements drop constraint if exists gmp_inventory_movements_movement_type_check;
alter table public.gmp_inventory_movements add constraint gmp_inventory_movements_movement_type_check check(movement_type = any(array['purchase','sale','sale_return','purchase_return','transfer_in','transfer_out','adjustment_in','adjustment_out','opening_balance','person_gold_purchase','repair_in','repair_out','exchange_in','exchange_out','manufacture_in','manufacture_out']));

create or replace function public.gmp_sync_gold_ledger_from_inventory_movement()
returns trigger language plpgsql set search_path=public as $$
declare v_product public.gmp_products%rowtype; v_karat numeric; v_direction text; v_total_value numeric;
begin
 if new.product_id is null then return new; end if;
 select * into v_product from public.gmp_products where id=new.product_id and store_id=new.store_id limit 1;
 if not found then raise exception 'gold_ledger_product_scope_invalid'; end if;
 v_karat:=nullif((regexp_match(trim(coalesce(v_product.karat,v_product.purity,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric;
 if v_karat is null or v_karat<=0 or v_karat>24 then return new; end if;
 v_direction:=case when new.movement_type in ('purchase','repair_in','adjustment_in','transfer_in','return_in','opening_balance','person_gold_purchase','exchange_in','manufacture_in') then 'in'
 when new.movement_type in ('sale','repair_out','adjustment_out','transfer_out','return_out','exchange_out','manufacture_out') then 'out' end;
 if v_direction is null then return new; end if;
 v_total_value:=round(case when coalesce(new.weight_grams,0)>0 then new.weight_grams*coalesce(new.unit_cost,0) else new.quantity*coalesce(new.unit_cost,0) end,6);
 insert into public.gmp_gold_ledger_entries(organization_id,branch_id,store_id,product_id,operation_type,direction,reference_type,reference_id,idempotency_key,karat,gross_weight_grams,stone_weight_grams,net_weight_grams,unit_value,making_charge,total_value,currency,metadata,created_by)
 values(new.organization_id,new.branch_id,new.store_id,new.product_id,
 case new.movement_type when 'purchase' then 'purchase' when 'sale' then 'sale' when 'repair_in' then 'repair_in' when 'repair_out' then 'repair_out' when 'transfer_in' then 'transfer_in' when 'transfer_out' then 'transfer_out' when 'person_gold_purchase' then 'buyback' when 'return_in' then 'sale_return' when 'return_out' then 'purchase_return' when 'adjustment_in' then 'adjustment' when 'adjustment_out' then 'adjustment' when 'opening_balance' then 'adjustment' when 'exchange_in' then 'exchange_in' when 'exchange_out' then 'exchange_out' when 'manufacture_in' then 'manufacture_in' when 'manufacture_out' then 'manufacture_out' end,
 v_direction,'inventory_movement',new.id,'inventory-movement:'||new.id::text,v_karat,coalesce(new.weight_grams,0),0,coalesce(new.weight_grams,0),coalesce(new.unit_cost,0),coalesce(v_product.making_charge,0),v_total_value,'OMR',
 jsonb_build_object('source','inventory_movement_trigger','movement_type',new.movement_type,'movement_id',new.id,'value_basis',case when coalesce(new.weight_grams,0)>0 then 'weight_x_unit_cost' else 'quantity_x_unit_cost' end),new.created_by)
 on conflict(organization_id,idempotency_key) do nothing;
 return new;
end; $$;

create or replace function public.gmp_create_manufacturing_order(
 p_organization_id uuid,p_branch_id uuid,p_store_id uuid,p_output_product_id uuid,
 p_planned_quantity numeric,p_planned_weight_grams numeric,p_components jsonb,p_client_ref text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_branch uuid; v_component jsonb; v_product uuid; v_qty numeric; v_weight numeric;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in('owner','admin')) then raise exception 'not authorized'; end if;
 if coalesce(trim(p_client_ref),'')='' or p_planned_quantity<=0 or p_planned_weight_grams<0 then raise exception 'invalid_manufacturing_order'; end if;
 if exists(select 1 from public.gmp_manufacturing_orders where organization_id=p_organization_id and client_ref=trim(p_client_ref)) then
   select id into v_id from public.gmp_manufacturing_orders where organization_id=p_organization_id and client_ref=trim(p_client_ref);
   return jsonb_build_object('success',true,'idempotent',true,'order_id',v_id);
 end if;
 select s.branch_id into v_branch from public.gmp_stores s where s.id=p_store_id and s.organization_id=p_organization_id;
 if not found then raise exception 'store_not_found'; end if;
 if p_branch_id is not null and p_branch_id<>v_branch then raise exception 'branch_store_mismatch'; end if;
 perform 1 from public.gmp_products p where p.id=p_output_product_id and p.store_id=p_store_id and p.active for update;
 if not found then raise exception 'output_product_scope_invalid'; end if;
 if jsonb_typeof(p_components)<>'array' or jsonb_array_length(p_components)=0 then raise exception 'components_required'; end if;
 insert into public.gmp_manufacturing_orders(organization_id,branch_id,store_id,output_product_id,planned_quantity,planned_weight_grams,client_ref,created_by)
 values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_output_product_id,p_planned_quantity,p_planned_weight_grams,trim(p_client_ref),v_actor) returning id into v_id;
 for v_component in select * from jsonb_array_elements(p_components) loop
   v_product:=(v_component->>'product_id')::uuid; v_qty:=(v_component->>'quantity')::numeric; v_weight:=coalesce((v_component->>'weight_grams')::numeric,0);
   if v_product=p_output_product_id or v_qty<=0 or v_weight<0 then raise exception 'invalid_component'; end if;
   perform 1 from public.gmp_products p where p.id=v_product and p.store_id=p_store_id and p.active;
   if not found then raise exception 'component_scope_invalid'; end if;
   insert into public.gmp_manufacturing_components(manufacturing_order_id,product_id,required_quantity,required_weight_grams,unit_cost)
   select v_id,v_product,v_qty,v_weight,p.cost_price from public.gmp_products p where p.id=v_product;
 end loop;
 return jsonb_build_object('success',true,'idempotent',false,'order_id',v_id);
end; $$;

create or replace function public.gmp_complete_manufacturing(
 p_order_id uuid,p_actual_quantity numeric,p_actual_weight_grams numeric,p_waste_weight_grams numeric,p_labor_cost numeric,p_client_ref text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_order public.gmp_manufacturing_orders%rowtype; v_comp record; v_total numeric:=0; v_component_cost numeric; v_output_cost numeric; v_inventory uuid; v_expense uuid; v_journal uuid; v_in_id uuid; v_out_id uuid;
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
   v_component_cost:=round(v_comp.required_quantity*coalesce(v_comp.cost_price,0),6);
   v_total:=v_total+v_component_cost;
 end loop;
 v_output_cost:=round(v_total+coalesce(p_labor_cost,0),6);
 select id into v_inventory from public.gmp_accounts where organization_id=v_order.organization_id and system_key='inventory' and active limit 1;
 select id into v_expense from public.gmp_accounts where organization_id=v_order.organization_id and system_key='operating_expenses' and active limit 1;
 if v_inventory is null or v_expense is null then raise exception 'manufacturing_accounts_missing'; end if;
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
 if p_labor_cost>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_expense,0,p_labor_cost,'تكلفة تصنيع مرسملة'); end if;
 if abs((select coalesce(sum(debit),0)-coalesce(sum(credit),0) from public.gmp_journal_lines where journal_entry_id=v_journal))>0.0005 then raise exception 'unbalanced manufacturing journal'; end if;
 update public.gmp_manufacturing_orders set status='completed',actual_quantity=p_actual_quantity,actual_weight_grams=p_actual_weight_grams,waste_weight_grams=p_waste_weight_grams,labor_cost=p_labor_cost,total_component_cost=v_total,total_cost=v_output_cost,journal_entry_id=v_journal,completed_by=v_actor,completed_at=now() where id=v_order.id;
 return jsonb_build_object('success',true,'idempotent',false,'order_id',v_order.id,'journal_entry_id',v_journal,'component_cost',v_total,'total_cost',v_output_cost,'gold_ledger_in_id',v_in_id,'gold_ledger_out_id',v_out_id);
end; $$;
revoke all on function public.gmp_create_manufacturing_order(uuid,uuid,uuid,uuid,numeric,numeric,jsonb,text) from public,anon;
revoke all on function public.gmp_complete_manufacturing(uuid,numeric,numeric,numeric,numeric,text) from public,anon;
grant execute on function public.gmp_create_manufacturing_order(uuid,uuid,uuid,uuid,numeric,numeric,jsonb,text) to authenticated;
grant execute on function public.gmp_complete_manufacturing(uuid,numeric,numeric,numeric,numeric,text) to authenticated;
create index if not exists gmp_manufacturing_components_order_idx on public.gmp_manufacturing_components(manufacturing_order_id);
create index if not exists gmp_manufacturing_orders_store_status_idx on public.gmp_manufacturing_orders(store_id,status,created_at desc);