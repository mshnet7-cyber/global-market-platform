-- Regression fix: inventory movement trigger is the single Gold Ledger writer for buybacks.
-- The original buyback RPC also posted directly, which could create two ledger entries.
create or replace function public.gmp_create_gold_buyback(
 p_organization_id uuid,p_branch_id uuid,p_store_id uuid,p_customer_id uuid,p_product_id uuid,
 p_karat numeric,p_gross_weight_grams numeric,p_stone_weight_grams numeric,p_unit_value numeric,
 p_payment_method text,p_client_ref text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_actor uuid := (select auth.uid());
 v_existing jsonb;
 v_id uuid;
 v_ledger_id uuid;
 v_journal uuid;
 v_payment uuid;
 v_inventory uuid;
 v_net numeric;
 v_total numeric;
 v_branch uuid;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 if not exists(
   select 1 from public.gmp_organization_members m
   where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')
 ) then raise exception 'not authorized'; end if;

 select jsonb_build_object('id',id,'organization_id',organization_id,'store_id',store_id,'total_value',total_value,'gold_ledger_entry_id',gold_ledger_entry_id,'journal_entry_id',journal_entry_id)
 into v_existing
 from public.gmp_gold_buybacks
 where organization_id=p_organization_id and client_ref=trim(p_client_ref);
 if v_existing is not null then
   return jsonb_build_object('success',true,'idempotent',true,'buyback',v_existing);
 end if;

 if p_product_id is null or p_karat<=0 or p_karat>24 or p_gross_weight_grams<=0
    or coalesce(p_stone_weight_grams,0)<0 or p_stone_weight_grams>p_gross_weight_grams or p_unit_value<0
 then raise exception 'invalid_gold_buyback'; end if;
 if p_payment_method not in ('cash','bank','card','wallet','other') then raise exception 'invalid payment method'; end if;

 select s.branch_id into v_branch
 from public.gmp_stores s
 where s.id=p_store_id and s.organization_id=p_organization_id;
 if not found then raise exception 'store not found'; end if;
 if p_branch_id is not null and p_branch_id<>v_branch then raise exception 'branch store mismatch'; end if;
 if p_customer_id is not null and not exists(
   select 1 from public.gmp_customers c where c.id=p_customer_id and c.organization_id=p_organization_id
 ) then raise exception 'customer not found'; end if;
 if not exists(
   select 1 from public.gmp_products p where p.id=p_product_id and p.store_id=p_store_id and p.active
 ) then raise exception 'product scope invalid'; end if;

 v_net:=p_gross_weight_grams-p_stone_weight_grams;
 v_total:=round(v_net*p_unit_value,6);

 select a.id into v_payment
 from public.gmp_accounts a
 where a.organization_id=p_organization_id
   and a.system_key=case p_payment_method when 'cash' then 'cash' when 'bank' then 'bank' when 'card' then 'card' when 'wallet' then 'wallet' else 'other' end
   and a.active limit 1;
 select a.id into v_inventory
 from public.gmp_accounts a
 where a.organization_id=p_organization_id and a.system_key='inventory' and a.active limit 1;
 if v_payment is null or v_inventory is null then raise exception 'buyback_accounts_missing'; end if;

 insert into public.gmp_gold_buybacks(
   organization_id,branch_id,store_id,customer_id,product_id,karat,gross_weight_grams,
   stone_weight_grams,net_weight_grams,unit_value,total_value,payment_method,client_ref,created_by
 )
 values(
   p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_customer_id,p_product_id,p_karat,
   p_gross_weight_grams,p_stone_weight_grams,v_net,p_unit_value,v_total,p_payment_method,trim(p_client_ref),v_actor
 )
 returning id into v_id;

 update public.gmp_products
 set current_quantity=current_quantity+1,current_weight_grams=current_weight_grams+v_net,cost_price=v_total,updated_at=now()
 where id=p_product_id;

 insert into public.gmp_inventory_movements(
   organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,
   reference_type,reference_id,created_by
 )
 values(
   p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_product_id,'person_gold_purchase',
   1,v_net,case when v_net>0 then v_total/v_net else 0 end,'gold_buyback',v_id,v_actor
 );

 -- The AFTER INSERT trigger writes exactly one Gold Ledger entry and is idempotent by movement id.
 select gle.id into v_ledger_id
 from public.gmp_gold_ledger_entries gle
 where gle.organization_id=p_organization_id
   and gle.reference_type='inventory_movement'
   and gle.reference_id=(select im.id from public.gmp_inventory_movements im where im.reference_type='gold_buyback' and im.reference_id=v_id order by im.created_at desc limit 1)
 limit 1;
 if v_ledger_id is null then raise exception 'gold_ledger_sync_failed'; end if;

 insert into public.gmp_journal_entries(
   organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by
 )
 values(
   p_organization_id,coalesce(p_branch_id,v_branch),'gold_buyback',v_id,
   'ترحيل شراء ذهب من عميل',current_date,'posted',v_actor
 )
 returning id into v_journal;

 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo)
 values(v_journal,v_inventory,v_total,0,'ذهب مشتَرى');
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo)
 values(v_journal,v_payment,0,v_total,'دفع شراء الذهب');

 update public.gmp_gold_buybacks
 set gold_ledger_entry_id=v_ledger_id,journal_entry_id=v_journal
 where id=v_id;

 return jsonb_build_object(
   'success',true,'idempotent',false,'buyback_id',v_id,
   'gold_ledger_entry_id',v_ledger_id,'journal_entry_id',v_journal,
   'net_weight_grams',v_net,'total_value',v_total
 );
end;
$$;

revoke all on function public.gmp_create_gold_buyback(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text) from public,anon;
grant execute on function public.gmp_create_gold_buyback(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text) to authenticated;