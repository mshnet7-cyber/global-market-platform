create table if not exists public.gmp_gold_exchanges (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
 branch_id uuid references public.gmp_branches(id),
 store_id uuid not null references public.gmp_stores(id),
 customer_id uuid references public.gmp_customers(id),
 old_product_id uuid not null references public.gmp_products(id),
 new_product_id uuid not null references public.gmp_products(id),
 old_karat numeric not null check(old_karat>0 and old_karat<=24),
 old_gross_weight_grams numeric not null check(old_gross_weight_grams>0),
 old_stone_weight_grams numeric not null default 0 check(old_stone_weight_grams>=0 and old_stone_weight_grams<=old_gross_weight_grams),
 old_net_weight_grams numeric not null,
 old_unit_value numeric not null check(old_unit_value>=0),
 old_total_value numeric not null,
 new_quantity numeric not null default 1 check(new_quantity>0),
 new_weight_grams numeric not null default 0 check(new_weight_grams>=0),
 new_unit_price numeric not null check(new_unit_price>=0),
 new_making_charge numeric not null default 0 check(new_making_charge>=0),
 new_discount numeric not null default 0 check(new_discount>=0),
 new_vat_amount numeric not null default 0 check(new_vat_amount>=0),
 new_total_value numeric not null,
 settlement_amount numeric not null,
 settlement_direction text not null check(settlement_direction in ('customer_pays','shop_pays','even')),
 payment_method text not null check(payment_method in ('cash','bank','card','wallet','other')),
 client_ref text not null,
 gold_ledger_in_id uuid,
 gold_ledger_out_id uuid,
 journal_entry_id uuid,
 status text not null default 'completed' check(status='completed'),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,client_ref)
);
alter table public.gmp_gold_exchanges enable row level security;
drop policy if exists gmp_gold_exchanges_member_read on public.gmp_gold_exchanges;
create policy gmp_gold_exchanges_member_read on public.gmp_gold_exchanges for select to authenticated using(exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_gold_exchanges.organization_id and m.user_id=auth.uid()));

create or replace function public.gmp_create_gold_exchange(
 p_organization_id uuid,p_branch_id uuid,p_store_id uuid,p_customer_id uuid,
 p_old_product_id uuid,p_old_karat numeric,p_old_gross_weight_grams numeric,p_old_stone_weight_grams numeric,p_old_unit_value numeric,
 p_new_product_id uuid,p_new_quantity numeric,p_new_weight_grams numeric,p_new_unit_price numeric,p_new_making_charge numeric,p_new_discount numeric,p_new_vat_amount numeric,
 p_payment_method text,p_client_ref text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=(select auth.uid()); v_existing jsonb; v_id uuid; v_branch uuid; v_old_net numeric; v_old_total numeric; v_new_total numeric; v_new_cost numeric; v_settlement numeric;
 v_payment uuid; v_inventory uuid; v_sales uuid; v_cogs uuid; v_journal uuid; v_in uuid; v_out uuid; v_old_cost_per_g numeric;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
 select jsonb_build_object('id',id,'settlement_amount',settlement_amount,'settlement_direction',settlement_direction,'gold_ledger_in_id',gold_ledger_in_id,'gold_ledger_out_id',gold_ledger_out_id,'journal_entry_id',journal_entry_id)
 into v_existing from public.gmp_gold_exchanges where organization_id=p_organization_id and client_ref=trim(p_client_ref);
 if v_existing is not null then return jsonb_build_object('success',true,'idempotent',true,'exchange',v_existing); end if;
 if p_old_karat<=0 or p_old_karat>24 or p_old_gross_weight_grams<=0 or coalesce(p_old_stone_weight_grams,0)<0 or p_old_stone_weight_grams>p_old_gross_weight_grams or p_old_unit_value<0 then raise exception 'invalid_old_gold'; end if;
 if p_new_quantity<=0 or p_new_weight_grams<0 or p_new_unit_price<0 or p_new_making_charge<0 or p_new_discount<0 or p_new_vat_amount<0 then raise exception 'invalid_new_item'; end if;
 if p_new_discount>(p_new_quantity*p_new_unit_price+p_new_making_charge) then raise exception 'discount_exceeds_new_item'; end if;
 if p_payment_method not in ('cash','bank','card','wallet','other') then raise exception 'invalid payment method'; end if;
 select s.branch_id into v_branch from public.gmp_stores s where s.id=p_store_id and s.organization_id=p_organization_id;
 if not found then raise exception 'store_not_found'; end if;
 if p_branch_id is not null and p_branch_id<>v_branch then raise exception 'branch_store_mismatch'; end if;
 if p_customer_id is not null and not exists(select 1 from public.gmp_customers c where c.id=p_customer_id and c.organization_id=p_organization_id) then raise exception 'customer_not_found'; end if;
 select id into v_branch from public.gmp_products where id=p_old_product_id and store_id=p_store_id and active for update;
 if not found then raise exception 'old_product_scope_invalid'; end if;
 select id,cost_price into v_in,v_new_cost from public.gmp_products where id=p_new_product_id and store_id=p_store_id and active for update;
 if not found then raise exception 'new_product_scope_invalid'; end if;
 if p_old_product_id=p_new_product_id then raise exception 'exchange_products_must_differ'; end if;
 if v_new_cost is null then v_new_cost:=0; end if;
 select current_quantity,current_weight_grams into v_new_cost,v_new_cost from public.gmp_products where id=p_new_product_id; -- overwritten below
 v_old_net:=p_old_gross_weight_grams-p_old_stone_weight_grams;
 v_old_total:=round(v_old_net*p_old_unit_value,6);
 v_new_total:=round(p_new_quantity*p_new_unit_price+p_new_making_charge-p_new_discount+p_new_vat_amount,6);
 v_settlement:=round(v_new_total-v_old_total,6);
 select a.id into v_payment from public.gmp_accounts a where a.organization_id=p_organization_id and a.system_key=case p_payment_method when 'cash' then 'cash' when 'bank' then 'bank' when 'card' then 'card' when 'wallet' then 'wallet' else 'other' end and a.active limit 1;
 select a.id into v_inventory from public.gmp_accounts a where a.organization_id=p_organization_id and a.system_key='inventory' and a.active limit 1;
 select a.id into v_sales from public.gmp_accounts a where a.organization_id=p_organization_id and a.system_key='sales' and a.active limit 1;
 select a.id into v_cogs from public.gmp_accounts a where a.organization_id=p_organization_id and a.system_key='cogs' and a.active limit 1;
 if v_payment is null or v_inventory is null or v_sales is null or v_cogs is null then raise exception 'exchange_accounts_missing'; end if;
 -- Re-read cost after lock.
 select cost_price into v_new_cost from public.gmp_products where id=p_new_product_id for update;
 v_new_cost:=round(p_new_quantity*coalesce(v_new_cost,0),6);
 if (select current_quantity from public.gmp_products where id=p_new_product_id)<p_new_quantity then raise exception 'insufficient_new_inventory'; end if;
 insert into public.gmp_gold_exchanges(organization_id,branch_id,store_id,customer_id,old_product_id,new_product_id,old_karat,old_gross_weight_grams,old_stone_weight_grams,old_net_weight_grams,old_unit_value,old_total_value,new_quantity,new_weight_grams,new_unit_price,new_making_charge,new_discount,new_vat_amount,new_total_value,settlement_amount,settlement_direction,payment_method,client_ref,created_by)
 values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_customer_id,p_old_product_id,p_new_product_id,p_old_karat,p_old_gross_weight_grams,p_old_stone_weight_grams,v_old_net,p_old_unit_value,v_old_total,p_new_quantity,p_new_weight_grams,p_new_unit_price,p_new_making_charge,p_new_discount,p_new_vat_amount,v_new_total,abs(v_settlement),case when v_settlement>0 then 'customer_pays' when v_settlement<0 then 'shop_pays' else 'even' end,p_payment_method,trim(p_client_ref),v_actor) returning id into v_id;
 update public.gmp_products set current_quantity=current_quantity+1,current_weight_grams=current_weight_grams+v_old_net,cost_price=v_old_total,updated_at=now() where id=p_old_product_id;
 update public.gmp_products set current_quantity=current_quantity-p_new_quantity,current_weight_grams=current_weight_grams-p_new_weight_grams,updated_at=now() where id=p_new_product_id;
 insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_old_product_id,'exchange_in',1,v_old_net,case when v_old_net>0 then v_old_total/v_old_net else 0 end,'gold_exchange',v_id,v_actor);
 insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_new_product_id,'exchange_out',p_new_quantity,p_new_weight_grams,coalesce(v_new_cost,0)/greatest(p_new_quantity,1),'gold_exchange',v_id,v_actor);
 select id into v_in from public.gmp_gold_ledger_entries where reference_type='inventory_movement' and reference_id=(select im.id from public.gmp_inventory_movements im where im.reference_type='gold_exchange' and im.reference_id=v_id and im.movement_type='exchange_in' order by created_at desc limit 1) limit 1;
 select id into v_out from public.gmp_gold_ledger_entries where reference_type='inventory_movement' and reference_id=(select im.id from public.gmp_inventory_movements im where im.reference_type='gold_exchange' and im.reference_id=v_id and im.movement_type='exchange_out' order by created_at desc limit 1) limit 1;
 if v_in is null or v_out is null then raise exception 'exchange_gold_ledger_sync_failed'; end if;
 insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),'gold_exchange',v_id,'ترحيل مبادلة ذهب',current_date,'posted',v_actor) returning id into v_journal;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_inventory,v_old_total,0,'ذهب مستلم بالمبادلة');
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_cogs,v_new_cost,0,'تكلفة الذهب المسلم');
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_sales,0,v_new_total,'قيمة البيع بالمبادلة');
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_inventory,0,v_new_cost,'خروج المخزون المسلم');
 if v_settlement>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_payment,v_settlement,0,'فرق مدفوع من العميل');
 elsif v_settlement<0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_payment,0,abs(v_settlement),'فرق مدفوع للعميل'); end if;
 if abs((select coalesce(sum(debit),0)-coalesce(sum(credit),0) from public.gmp_journal_lines where journal_entry_id=v_journal))>0.0005 then raise exception 'unbalanced exchange journal'; end if;
 update public.gmp_gold_exchanges set gold_ledger_in_id=v_in,gold_ledger_out_id=v_out,journal_entry_id=v_journal where id=v_id;
 return jsonb_build_object('success',true,'idempotent',false,'exchange_id',v_id,'gold_ledger_in_id',v_in,'gold_ledger_out_id',v_out,'journal_entry_id',v_journal,'settlement_amount',abs(v_settlement),'settlement_direction',case when v_settlement>0 then 'customer_pays' when v_settlement<0 then 'shop_pays' else 'even' end);
end; $$;
revoke all on function public.gmp_create_gold_exchange(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,text) from public,anon;
grant execute on function public.gmp_create_gold_exchange(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,text) to authenticated;