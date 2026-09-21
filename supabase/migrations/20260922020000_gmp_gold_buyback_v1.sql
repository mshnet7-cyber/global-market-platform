create table if not exists public.gmp_gold_buybacks (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
 branch_id uuid references public.gmp_branches(id),
 store_id uuid not null references public.gmp_stores(id),
 customer_id uuid references public.gmp_customers(id),
 product_id uuid references public.gmp_products(id),
 karat numeric not null,
 gross_weight_grams numeric not null,
 stone_weight_grams numeric not null default 0,
 net_weight_grams numeric not null,
 unit_value numeric not null,
 total_value numeric not null,
 currency text not null default 'OMR',
 payment_method text not null,
 status text not null default 'posted',
 client_ref text not null,
 gold_ledger_entry_id uuid references public.gmp_gold_ledger_entries(id),
 journal_entry_id uuid references public.gmp_journal_entries(id),
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique(organization_id,client_ref)
);
alter table public.gmp_gold_buybacks enable row level security;
drop policy if exists gmp_gold_buybacks_member_read on public.gmp_gold_buybacks;
create policy gmp_gold_buybacks_member_read on public.gmp_gold_buybacks for select to authenticated
using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_gold_buybacks.organization_id and m.user_id=auth.uid()));

create or replace function public.gmp_create_gold_buyback(
 p_organization_id uuid,p_branch_id uuid,p_store_id uuid,p_customer_id uuid,p_product_id uuid,
 p_karat numeric,p_gross_weight_grams numeric,p_stone_weight_grams numeric,p_unit_value numeric,
 p_payment_method text,p_client_ref text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_actor uuid:=auth.uid(); v_existing jsonb; v_id uuid; v_ledger jsonb; v_ledger_id uuid;
 v_journal uuid; v_payment uuid; v_inventory uuid; v_net numeric; v_total numeric; v_branch uuid;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if coalesce(trim(p_client_ref),'')='' then raise exception 'client_ref_required'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
 select jsonb_build_object('id',id,'organization_id',organization_id,'store_id',store_id,'total_value',total_value,'gold_ledger_entry_id',gold_ledger_entry_id,'journal_entry_id',journal_entry_id)
 into v_existing from public.gmp_gold_buybacks where organization_id=p_organization_id and client_ref=trim(p_client_ref);
 if v_existing is not null then return jsonb_build_object('success',true,'idempotent',true,'buyback',v_existing); end if;
 if p_product_id is null or p_karat<=0 or p_karat>24 or p_gross_weight_grams<=0 or coalesce(p_stone_weight_grams,0)<0 or p_stone_weight_grams>p_gross_weight_grams or p_unit_value<0 then raise exception 'invalid_gold_buyback'; end if;
 if p_payment_method not in ('cash','bank','card','wallet','other') then raise exception 'invalid payment method'; end if;
 select branch_id into v_branch from public.gmp_stores where id=p_store_id and organization_id=p_organization_id;
 if not found then raise exception 'store not found'; end if;
 if p_branch_id is not null and p_branch_id<>v_branch then raise exception 'branch store mismatch'; end if;
 if p_customer_id is not null and not exists(select 1 from public.gmp_customers where id=p_customer_id and organization_id=p_organization_id) then raise exception 'customer not found'; end if;
 if not exists(select 1 from public.gmp_products p where p.id=p_product_id and p.store_id=p_store_id and p.active) then raise exception 'product scope invalid'; end if;
 v_net:=p_gross_weight_grams-p_stone_weight_grams; v_total:=round(v_net*p_unit_value,6);
 select id into v_payment from public.gmp_accounts where organization_id=p_organization_id and system_key=case p_payment_method when 'cash' then 'cash' when 'bank' then 'bank' when 'card' then 'card' when 'wallet' then 'wallet' else 'other' end and active limit 1;
 select id into v_inventory from public.gmp_accounts where organization_id=p_organization_id and system_key='inventory' and active limit 1;
 if v_payment is null or v_inventory is null then raise exception 'buyback_accounts_missing'; end if;
 insert into public.gmp_gold_buybacks(organization_id,branch_id,store_id,customer_id,product_id,karat,gross_weight_grams,stone_weight_grams,net_weight_grams,unit_value,total_value,payment_method,client_ref,created_by)
 values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_customer_id,p_product_id,p_karat,p_gross_weight_grams,p_stone_weight_grams,v_net,p_unit_value,v_total,p_payment_method,trim(p_client_ref),v_actor)
 returning id into v_id;
 update public.gmp_products set current_quantity=current_quantity+1,current_weight_grams=current_weight_grams+v_net,cost_price=v_total,updated_at=now() where id=p_product_id;
 insert into public.gmp_inventory_movements(organization_id,branch_id,store_id,product_id,movement_type,quantity,weight_grams,unit_cost,reference_type,reference_id,created_by)
 values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_product_id,'person_gold_purchase',1,v_net,case when v_net>0 then v_total/v_net else 0 end,'gold_buyback',v_id,v_actor);
 select public.gmp_post_gold_ledger_entry(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_product_id,'buyback','in','gold_buyback',v_id,'gold-buyback:'||v_id,p_karat,p_gross_weight_grams,p_stone_weight_grams,v_net,p_unit_value,0,v_total,'OMR',jsonb_build_object('customer_id',p_customer_id,'payment_method',p_payment_method)) into v_ledger;
 v_ledger_id:=(v_ledger->>'entry_id')::uuid;
 insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by)
 values(p_organization_id,coalesce(p_branch_id,v_branch),'gold_buyback',v_id,'ترحيل شراء ذهب من عميل',current_date,'posted',v_actor) returning id into v_journal;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_inventory,v_total,0,'ذهب مشتَرى');
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal,v_payment,0,v_total,'دفع شراء الذهب');
 update public.gmp_gold_buybacks set gold_ledger_entry_id=v_ledger_id,journal_entry_id=v_journal where id=v_id;
 return jsonb_build_object('success',true,'idempotent',false,'buyback_id',v_id,'gold_ledger_entry_id',v_ledger_id,'journal_entry_id',v_journal,'net_weight_grams',v_net,'total_value',v_total);
end; $$;
revoke all on function public.gmp_create_gold_buyback(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text) from public,anon;
grant execute on function public.gmp_create_gold_buyback(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text) to authenticated;