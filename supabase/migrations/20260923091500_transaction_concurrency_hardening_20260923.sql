-- Harden transaction concurrency for gold and manufacturing idempotency, and deterministic sale product locking.
-- Generated from verified Production definitions on 2026-09-23.

CREATE OR REPLACE FUNCTION public.gmp_create_and_post_sale(p_organization_id uuid, p_branch_id uuid, p_store_id uuid, p_customer_id uuid, p_payment_method text, p_notes text, p_lines jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := (select auth.uid()); v_sale_id uuid; v_invoice_no bigint; v_journal_id uuid; v_payment_account uuid; v_inventory uuid; v_sales uuid; v_cogs uuid; v_vat uuid; v_cash uuid; v_bank uuid; v_card uuid; v_wallet uuid; v_other uuid; v_branch uuid;
  v_line jsonb; v_product uuid; v_qty numeric; v_weight numeric; v_unit_price numeric; v_making numeric; v_discount numeric; v_line_vat numeric; v_line_total numeric;
  v_subtotal numeric:=0; v_discount_total numeric:=0; v_vat_total numeric:=0; v_cogs_total numeric:=0; v_unit_cost numeric; v_available numeric; v_available_weight numeric;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if p_payment_method not in ('cash','bank','card','wallet','mixed','other') then raise exception 'invalid payment method'; end if;
  if p_payment_method='mixed' then raise exception 'mixed payment requires split tenders'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'sale lines required'; end if;
  if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
  select s.branch_id into v_branch from public.gmp_stores s where s.id=p_store_id and s.organization_id=p_organization_id;
  if not found then raise exception 'store not found'; end if;
  if p_branch_id is not null and not exists(select 1 from public.gmp_branches b where b.id=p_branch_id and b.organization_id=p_organization_id and b.active=true) then raise exception 'branch not found'; end if;
  if p_branch_id is not null and v_branch is not null and p_branch_id<>v_branch then raise exception 'branch store mismatch'; end if;
  if p_customer_id is not null and not exists(select 1 from public.gmp_customers c where c.id=p_customer_id and c.organization_id=p_organization_id) then raise exception 'customer not found'; end if;
  select id into v_cash from public.gmp_accounts where organization_id=p_organization_id and system_key='cash' and active limit 1; select id into v_bank from public.gmp_accounts where organization_id=p_organization_id and system_key='bank' and active limit 1; select id into v_card from public.gmp_accounts where organization_id=p_organization_id and system_key='card' and active limit 1; select id into v_wallet from public.gmp_accounts where organization_id=p_organization_id and system_key='wallet' and active limit 1; select id into v_other from public.gmp_accounts where organization_id=p_organization_id and system_key='other' and active limit 1; select id into v_inventory from public.gmp_accounts where organization_id=p_organization_id and system_key='inventory' and active limit 1; select id into v_sales from public.gmp_accounts where organization_id=p_organization_id and system_key='sales' and active limit 1; select id into v_cogs from public.gmp_accounts where organization_id=p_organization_id and system_key='cogs' and active limit 1; select id into v_vat from public.gmp_accounts where organization_id=p_organization_id and system_key='vat_payable' and active limit 1;
  v_payment_account:=case p_payment_method when 'cash' then v_cash when 'bank' then v_bank when 'card' then v_card when 'wallet' then v_wallet else v_other end;
  if v_payment_account is null or v_inventory is null or v_sales is null or v_cogs is null then raise exception 'default accounts missing'; end if;
  for v_line in select value from jsonb_array_elements(p_lines) order by (value->>'product_id') loop
    v_product:=(v_line->>'product_id')::uuid; v_qty:=nullif(v_line->>'quantity','')::numeric; v_weight:=coalesce(nullif(v_line->>'weight_grams','')::numeric,0); v_unit_price:=coalesce(nullif(v_line->>'unit_price','')::numeric,0); v_making:=coalesce(nullif(v_line->>'making_charge','')::numeric,0); v_discount:=coalesce(nullif(v_line->>'discount_amount','')::numeric,0); v_line_vat:=coalesce(nullif(v_line->>'vat_amount','')::numeric,0);
    if v_product is null or v_qty is null or v_qty<=0 or v_weight<0 or v_unit_price<0 or v_making<0 or v_discount<0 or v_line_vat<0 then raise exception 'invalid sale line'; end if;
    if v_discount>(v_qty*v_unit_price+v_making) then raise exception 'discount exceeds line amount'; end if;
    select current_quantity,current_weight_grams,cost_price into v_available,v_available_weight,v_unit_cost from public.gmp_products where id=v_product and store_id=p_store_id and active=true for update;
    if not found then raise exception 'product not found'; end if;
    if v_available<v_qty or v_available_weight<v_weight then raise exception 'insufficient inventory'; end if;
    v_subtotal:=v_subtotal+(v_qty*v_unit_price)+v_making-v_discount; v_discount_total:=v_discount_total+v_discount; v_vat_total:=v_vat_total+v_line_vat;
  end loop;
  insert into public.gmp_sales(organization_id,branch_id,store_id,customer_id,status,subtotal,discount_amount,vat_amount,total,payment_method,notes,issued_at,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_customer_id,'issued',v_subtotal,v_discount_total,v_vat_total,v_subtotal+v_vat_total,p_payment_method,p_notes,now(),v_actor) returning id,invoice_no into v_sale_id,v_invoice_no;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_product:=(v_line->>'product_id')::uuid; v_qty:=(v_line->>'quantity')::numeric; v_weight:=coalesce(nullif(v_line->>'weight_grams','')::numeric,0); v_unit_price:=coalesce(nullif(v_line->>'unit_price','')::numeric,0); v_making:=coalesce(nullif(v_line->>'making_charge','')::numeric,0); v_discount:=coalesce(nullif(v_line->>'discount_amount','')::numeric,0); v_line_vat:=coalesce(nullif(v_line->>'vat_amount','')::numeric,0); select cost_price into v_unit_cost from public.gmp_products where id=v_product for update; v_line_total:=(v_qty*v_unit_price)+v_making-v_discount+v_line_vat;
    insert into public.gmp_sale_lines(sale_id,product_id,quantity,weight_grams,unit_price,making_charge,discount_amount,vat_amount) values(v_sale_id,v_product,v_qty,v_weight,v_unit_price,v_making,v_discount,v_line_vat);
    update public.gmp_products set current_quantity=current_quantity-v_qty,current_weight_grams=current_weight_grams-v_weight,updated_at=now() where id=v_product;
    insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,v_product,'sale',v_qty,v_weight,coalesce(v_unit_cost,0),'sale',v_sale_id,v_actor); v_cogs_total:=v_cogs_total+(v_qty*coalesce(v_unit_cost,0));
  end loop;
  insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),'sale',v_sale_id,'ترحيل بيع',current_date,'posted',v_actor) returning id into v_journal_id;
  insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_payment_account,v_subtotal+v_vat_total,0,'إجمالي البيع'); insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_sales,0,v_subtotal,'صافي المبيعات');
  if v_vat_total>0 then if v_vat is null then raise exception 'VAT account missing'; end if; insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_vat,0,v_vat_total,'ضريبة القيمة المضافة'); end if;
  if v_cogs_total>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_cogs,v_cogs_total,0,'تكلفة المبيعات'); insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_inventory,0,v_cogs_total,'خروج مخزون'); end if;
  if abs((select coalesce(sum(debit),0)-coalesce(sum(credit),0) from public.gmp_journal_lines where journal_entry_id=v_journal_id))>0.0005 then raise exception 'unbalanced journal entry'; end if;
  return jsonb_build_object('success',true,'sale_id',v_sale_id,'invoice_no',v_invoice_no,'journal_id',v_journal_id,'subtotal',v_subtotal,'discount_amount',v_discount_total,'vat_amount',v_vat_total,'total',v_subtotal+v_vat_total);
end; $function$;

CREATE OR REPLACE FUNCTION public.gmp_create_gold_buyback(p_organization_id uuid, p_branch_id uuid, p_store_id uuid, p_customer_id uuid, p_product_id uuid, p_karat numeric, p_gross_weight_grams numeric, p_stone_weight_grams numeric, p_unit_value numeric, p_payment_method text, p_client_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmp-gold-buyback:'||p_organization_id::text||':'||trim(p_client_ref),0));
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
$function$;

CREATE OR REPLACE FUNCTION public.gmp_create_gold_exchange(p_organization_id uuid, p_branch_id uuid, p_store_id uuid, p_customer_id uuid, p_old_product_id uuid, p_old_karat numeric, p_old_gross_weight_grams numeric, p_old_stone_weight_grams numeric, p_old_unit_value numeric, p_new_product_id uuid, p_new_quantity numeric, p_new_weight_grams numeric, p_new_unit_price numeric, p_new_making_charge numeric, p_new_discount numeric, p_new_vat_amount numeric, p_payment_method text, p_client_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_actor uuid:=(select auth.uid()); v_existing jsonb; v_id uuid; v_branch uuid; v_old_net numeric; v_old_total numeric; v_new_total numeric; v_new_cost numeric; v_settlement numeric;
 v_payment uuid; v_inventory uuid; v_sales uuid; v_cogs uuid; v_journal uuid; v_in uuid; v_out uuid;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmp-gold-exchange:'||p_organization_id::text||':'||trim(p_client_ref),0));
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
 perform 1 from public.gmp_products where id=p_old_product_id and store_id=p_store_id and active for update;
 if not found then raise exception 'old_product_scope_invalid'; end if;
 select cost_price into v_new_cost from public.gmp_products where id=p_new_product_id and store_id=p_store_id and active for update;
 if not found then raise exception 'new_product_scope_invalid'; end if;
 if p_old_product_id=p_new_product_id then raise exception 'exchange_products_must_differ'; end if;
 if v_new_cost is null then v_new_cost:=0; end if;
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
end; $function$;

CREATE OR REPLACE FUNCTION public.gmp_create_manufacturing_order(p_organization_id uuid, p_branch_id uuid, p_store_id uuid, p_output_product_id uuid, p_planned_quantity numeric, p_planned_weight_grams numeric, p_components jsonb, p_client_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid:=auth.uid(); v_id uuid; v_branch uuid; v_component jsonb; v_product uuid; v_qty numeric; v_weight numeric;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in('owner','admin')) then raise exception 'not authorized'; end if;
 if coalesce(trim(p_client_ref),'')='' or p_planned_quantity<=0 or p_planned_weight_grams<0 then raise exception 'invalid_manufacturing_order'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('gmp-manufacturing-order:'||p_organization_id::text||':'||trim(p_client_ref),0));
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
end; $function$;
