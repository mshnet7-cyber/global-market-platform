-- Applied to the production Supabase project as version 20260916024223.
-- Performance: remove overlapping GMP SELECT policies and add missing FK indexes.
DROP POLICY IF EXISTS gmp_accounts_admin_write ON public.gmp_accounts;
DROP POLICY IF EXISTS gmp_accounts_member_read ON public.gmp_accounts;
CREATE POLICY gmp_accounts_member_read ON public.gmp_accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_accounts.organization_id AND m.user_id = (select auth.uid())));
CREATE POLICY gmp_accounts_admin_insert ON public.gmp_accounts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_accounts.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin')));
CREATE POLICY gmp_accounts_admin_update ON public.gmp_accounts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_accounts.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_accounts.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin')));
CREATE POLICY gmp_accounts_admin_delete ON public.gmp_accounts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_accounts.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin')));
DROP POLICY IF EXISTS gmp_ad_campaigns_owner_read ON public.gmp_ad_campaigns;
DROP POLICY IF EXISTS gmp_ad_campaigns_owner_write ON public.gmp_ad_campaigns;
CREATE POLICY gmp_ad_campaigns_owner_read ON public.gmp_ad_campaigns FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_ad_campaigns.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin')));
CREATE POLICY gmp_ad_campaigns_owner_insert ON public.gmp_ad_campaigns FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_ad_campaigns.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin')));
CREATE POLICY gmp_ad_campaigns_owner_update ON public.gmp_ad_campaigns FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_ad_campaigns.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin'))) WITH CHECK (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_ad_campaigns.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin')));
CREATE POLICY gmp_ad_campaigns_owner_delete ON public.gmp_ad_campaigns FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id = gmp_ad_campaigns.organization_id AND m.user_id = (select auth.uid()) AND m.role IN ('owner','admin')));
DROP POLICY IF EXISTS gmp_screen_admin_read ON public.gmp_screens;
DROP POLICY IF EXISTS gmp_screens_owner_select ON public.gmp_screens;
CREATE POLICY gmp_screens_read ON public.gmp_screens FOR SELECT TO authenticated USING ((EXISTS (SELECT 1 FROM public.gmp_profiles p WHERE p.id=(select auth.uid()) AND p.role='platform_admin')) OR EXISTS (SELECT 1 FROM public.gmp_stores s JOIN public.gmp_organizations o ON o.id=s.organization_id WHERE s.id=gmp_screens.store_id AND (o.owner_id=(select auth.uid()) OR EXISTS (SELECT 1 FROM public.gmp_organization_members m WHERE m.organization_id=o.id AND m.user_id=(select auth.uid())))));
CREATE INDEX IF NOT EXISTS gmp_ad_campaigns_created_by_idx ON public.gmp_ad_campaigns(created_by);
CREATE INDEX IF NOT EXISTS gmp_inventory_movements_created_by_idx ON public.gmp_inventory_movements(created_by);
CREATE INDEX IF NOT EXISTS gmp_inventory_movements_product_idx ON public.gmp_inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS gmp_inventory_movements_store_idx ON public.gmp_inventory_movements(store_id);
CREATE INDEX IF NOT EXISTS gmp_journal_entries_branch_idx ON public.gmp_journal_entries(branch_id);
CREATE INDEX IF NOT EXISTS gmp_journal_entries_created_by_idx ON public.gmp_journal_entries(created_by);
CREATE OR REPLACE FUNCTION public.gmp_seed_default_accounts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  insert into public.gmp_accounts(organization_id,code,name,account_type,system_key) values
    (new.id,'1000','النقدية','asset','cash'),(new.id,'1010','البنك','asset','bank'),(new.id,'1020','البطاقات','asset','card'),(new.id,'1030','المحفظة الإلكترونية','asset','wallet'),(new.id,'1090','طرق دفع أخرى','asset','other'),(new.id,'1100','المخزون','asset','inventory'),(new.id,'2000','الموردون','liability','payables'),(new.id,'2100','ضريبة القيمة المضافة','liability','vat_payable'),(new.id,'4000','المبيعات','revenue','sales'),(new.id,'5000','تكلفة المبيعات','expense','cogs'),(new.id,'6000','المصاريف التشغيلية','expense','operating_expenses')
  on conflict (organization_id,code) do nothing;
  return new;
end;
$$;
insert into public.gmp_accounts(organization_id,code,name,account_type,system_key)
select o.id, x.code, x.name, x.account_type, x.system_key from public.gmp_organizations o cross join (values ('1000','النقدية','asset','cash'),('1010','البنك','asset','bank'),('1020','البطاقات','asset','card'),('1030','المحفظة الإلكترونية','asset','wallet'),('1090','طرق دفع أخرى','asset','other'),('1100','المخزون','asset','inventory'),('2000','الموردون','liability','payables'),('2100','ضريبة القيمة المضافة','liability','vat_payable'),('4000','المبيعات','revenue','sales'),('5000','تكلفة المبيعات','expense','cogs'),('6000','المصاريف التشغيلية','expense','operating_expenses')) as x(code,name,account_type,system_key) on conflict (organization_id,code) do nothing;
CREATE OR REPLACE FUNCTION public.gmp_create_and_post_sale(p_organization_id uuid,p_branch_id uuid,p_store_id uuid,p_customer_id uuid,p_payment_method text,p_notes text,p_lines jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
declare
  v_actor uuid := (select auth.uid()); v_sale_id uuid; v_invoice_no bigint; v_journal_id uuid;
  v_payment_account uuid; v_inventory uuid; v_sales uuid; v_cogs uuid; v_vat uuid;
  v_cash uuid; v_bank uuid; v_card uuid; v_wallet uuid; v_other uuid; v_branch uuid;
  v_line jsonb; v_product uuid; v_qty numeric; v_weight numeric; v_unit_price numeric; v_making numeric; v_discount numeric; v_line_vat numeric; v_line_total numeric;
  v_subtotal numeric:=0; v_vat_total numeric:=0; v_cogs_total numeric:=0; v_unit_cost numeric; v_available numeric; v_available_weight numeric;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if p_payment_method not in ('cash','bank','card','wallet','mixed','other') then raise exception 'invalid payment method'; end if;
  if p_payment_method='mixed' then raise exception 'mixed payment requires split tenders'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'sale lines required'; end if;
  if not exists (select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
  select s.branch_id into v_branch from public.gmp_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.active=true;
  if not found then raise exception 'store not found'; end if;
  if p_branch_id is not null and v_branch is not null and p_branch_id<>v_branch then raise exception 'branch store mismatch'; end if;
  if p_customer_id is not null and not exists (select 1 from public.gmp_customers c where c.id=p_customer_id and c.organization_id=p_organization_id) then raise exception 'customer not found'; end if;
  select id into v_cash from public.gmp_accounts where organization_id=p_organization_id and system_key='cash' and active limit 1;
  select id into v_bank from public.gmp_accounts where organization_id=p_organization_id and system_key='bank' and active limit 1;
  select id into v_card from public.gmp_accounts where organization_id=p_organization_id and system_key='card' and active limit 1;
  select id into v_wallet from public.gmp_accounts where organization_id=p_organization_id and system_key='wallet' and active limit 1;
  select id into v_other from public.gmp_accounts where organization_id=p_organization_id and system_key='other' and active limit 1;
  select id into v_inventory from public.gmp_accounts where organization_id=p_organization_id and system_key='inventory' and active limit 1;
  select id into v_sales from public.gmp_accounts where organization_id=p_organization_id and system_key='sales' and active limit 1;
  select id into v_cogs from public.gmp_accounts where organization_id=p_organization_id and system_key='cogs' and active limit 1;
  select id into v_vat from public.gmp_accounts where organization_id=p_organization_id and system_key='vat_payable' and active limit 1;
  v_payment_account:=case p_payment_method when 'cash' then v_cash when 'bank' then v_bank when 'card' then v_card when 'wallet' then v_wallet else v_other end;
  if v_payment_account is null or v_inventory is null or v_sales is null or v_cogs is null then raise exception 'default accounts missing'; end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_product:=(v_line->>'product_id')::uuid; v_qty:=nullif(v_line->>'quantity','')::numeric; v_weight:=coalesce(nullif(v_line->>'weight_grams','')::numeric,0); v_unit_price:=coalesce(nullif(v_line->>'unit_price','')::numeric,0); v_making:=coalesce(nullif(v_line->>'making_charge','')::numeric,0); v_discount:=coalesce(nullif(v_line->>'discount_amount','')::numeric,0); v_line_vat:=coalesce(nullif(v_line->>'vat_amount','')::numeric,0);
    if v_product is null or v_qty is null or v_qty<=0 or v_weight<0 or v_unit_price<0 or v_making<0 or v_discount<0 or v_line_vat<0 then raise exception 'invalid sale line'; end if;
    if v_discount>(v_qty*v_unit_price+v_making) then raise exception 'discount exceeds line amount'; end if;
    select current_quantity,current_weight_grams,cost_price into v_available,v_available_weight,v_unit_cost from public.gmp_products where id=v_product and store_id=p_store_id and active=true for update;
    if not found then raise exception 'product not found'; end if;
    if v_available<v_qty or v_available_weight<v_weight then raise exception 'insufficient inventory'; end if;
    v_subtotal:=v_subtotal+(v_qty*v_unit_price)+v_making-v_discount; v_vat_total:=v_vat_total+v_line_vat;
  end loop;
  insert into public.gmp_sales(organization_id,branch_id,store_id,customer_id,status,subtotal,discount_amount,vat_amount,total,payment_method,notes,issued_at,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_customer_id,'issued',v_subtotal,0,v_vat_total,v_subtotal+v_vat_total,p_payment_method,p_notes,now(),v_actor) returning id,invoice_no into v_sale_id,v_invoice_no;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_product:=(v_line->>'product_id')::uuid; v_qty:=(v_line->>'quantity')::numeric; v_weight:=coalesce(nullif(v_line->>'weight_grams','')::numeric,0); v_unit_price:=coalesce(nullif(v_line->>'unit_price','')::numeric,0); v_making:=coalesce(nullif(v_line->>'making_charge','')::numeric,0); v_discount:=coalesce(nullif(v_line->>'discount_amount','')::numeric,0); v_line_vat:=coalesce(nullif(v_line->>'vat_amount','')::numeric,0);
    select cost_price into v_unit_cost from public.gmp_products where id=v_product for update;
    v_line_total:=(v_qty*v_unit_price)+v_making-v_discount+v_line_vat;
    insert into public.gmp_sale_lines(sale_id,product_id,quantity,weight_grams,unit_price,making_charge,discount_amount,vat_amount,line_total) values(v_sale_id,v_product,v_qty,v_weight,v_unit_price,v_making,v_discount,v_line_vat,v_line_total);
    update public.gmp_products set current_quantity=current_quantity-v_qty,current_weight_grams=current_weight_grams-v_weight,updated_at=now() where id=v_product;
    insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,v_product,'sale',v_qty,v_weight,coalesce(v_unit_cost,0),'sale',v_sale_id,v_actor);
    v_cogs_total:=v_cogs_total+(v_qty*coalesce(v_unit_cost,0));
  end loop;
  insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by) values(p_organization_id,coalesce(p_branch_id,v_branch),'sale',v_sale_id,'ترحيل بيع',current_date,'posted',v_actor) returning id into v_journal_id;
  insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_payment_account,v_subtotal+v_vat_total,0,'إجمالي البيع');
  insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_sales,0,v_subtotal,'صافي المبيعات');
  if v_vat_total>0 then if v_vat is null then raise exception 'VAT account missing'; end if; insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_vat,0,v_vat_total,'ضريبة القيمة المضافة'); end if;
  if v_cogs_total>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_cogs,v_cogs_total,0,'تكلفة المبيعات'); insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_inventory,0,v_cogs_total,'خروج مخزون'); end if;
  if abs((select coalesce(sum(debit),0)-coalesce(sum(credit),0) from public.gmp_journal_lines where journal_entry_id=v_journal_id))>0.0005 then raise exception 'unbalanced journal entry'; end if;
  return jsonb_build_object('success',true,'sale_id',v_sale_id,'invoice_no',v_invoice_no,'journal_id',v_journal_id,'subtotal',v_subtotal,'vat_amount',v_vat_total,'total',v_subtotal+v_vat_total);
end;
$$;
REVOKE ALL ON FUNCTION public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb) TO authenticated;