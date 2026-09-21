create table if not exists public.gmp_purchase_receipt_idempotency (
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  client_ref text not null,
  purchase_id uuid not null references public.gmp_purchases(id) on delete cascade,
  response jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (organization_id, client_ref)
);
alter table public.gmp_purchase_receipt_idempotency enable row level security;
create policy gmp_purchase_receipt_idempotency_member_read on public.gmp_purchase_receipt_idempotency
for select using (exists (select 1 from public.gmp_organization_members m where m.organization_id=gmp_purchase_receipt_idempotency.organization_id and m.user_id=auth.uid()));

alter table public.gmp_purchase_lines
  add column if not exists received_quantity numeric not null default 0,
  add column if not exists received_weight_grams numeric not null default 0;

alter table public.gmp_purchase_lines drop constraint if exists gmp_purchase_lines_received_quantity_check;
alter table public.gmp_purchase_lines add constraint gmp_purchase_lines_received_quantity_check check (received_quantity >= 0 and received_quantity <= quantity);
alter table public.gmp_purchase_lines drop constraint if exists gmp_purchase_lines_received_weight_check;
alter table public.gmp_purchase_lines add constraint gmp_purchase_lines_received_weight_check check (received_weight_grams >= 0);

insert into public.gmp_accounts(organization_id,code,name,account_type,system_key)
select o.id,'1110','ضريبة القيمة المضافة - مدخلات','asset','vat_receivable'
from public.gmp_organizations o
where not exists (select 1 from public.gmp_accounts a where a.organization_id=o.id and a.system_key='vat_receivable');

create or replace function public.gmp_receive_purchase(p_purchase_id uuid,p_lines jsonb,p_client_ref text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_actor uuid := (select auth.uid()); v_purchase public.gmp_purchases%rowtype; v_line jsonb;
 v_line_id uuid; v_product uuid; v_qty numeric; v_weight numeric; v_ordered_qty numeric; v_ordered_weight numeric;
 v_unit_cost numeric; v_making numeric; v_vat numeric; v_received_subtotal numeric:=0; v_received_vat numeric:=0;
 v_inventory_account uuid; v_vat_account uuid; v_payables_account uuid; v_journal uuid; v_journal_total numeric; v_new_status text;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 select i.response into v_line from public.gmp_purchase_receipt_idempotency i
 where i.organization_id=v_purchase.organization_id and i.client_ref=trim(p_client_ref);
 if v_line is not null then return v_line; end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'receipt_lines_required'; end if;
 select * into v_purchase from public.gmp_purchases where id=p_purchase_id for update;
 if not found then raise exception 'purchase_not_found'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=v_purchase.organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
 if v_purchase.status not in ('draft','approved') then raise exception 'invalid_purchase_status'; end if;
 select id into v_inventory_account from public.gmp_accounts where organization_id=v_purchase.organization_id and system_key='inventory' and active limit 1;
 select id into v_vat_account from public.gmp_accounts where organization_id=v_purchase.organization_id and system_key='vat_receivable' and active limit 1;
 select id into v_payables_account from public.gmp_accounts where organization_id=v_purchase.organization_id and system_key='payables' and active limit 1;
 if v_inventory_account is null or v_payables_account is null then raise exception 'purchase_accounts_missing'; end if;

 for v_line in select value from jsonb_array_elements(p_lines) loop
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
end; $$;

revoke all on function public.gmp_receive_purchase(uuid,jsonb,text) from public,anon;
grant execute on function public.gmp_receive_purchase(uuid,jsonb,text) to authenticated;