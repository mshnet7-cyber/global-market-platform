create or replace function public.gmp_process_repair(
 p_repair_id uuid,p_action text,p_store_id uuid,p_payment_method text,p_client_ref text
) returns jsonb language plpgsql security definer set search_path='' as $$
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
end; $$;
revoke all on function public.gmp_process_repair(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.gmp_process_repair(uuid,text,uuid,text,text) to authenticated;