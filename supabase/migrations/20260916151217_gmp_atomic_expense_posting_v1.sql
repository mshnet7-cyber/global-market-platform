CREATE OR REPLACE FUNCTION public.gmp_create_and_post_expense(p_organization_id uuid,p_branch_id uuid,p_category text,p_description text,p_amount numeric,p_vat_amount numeric,p_expense_date date,p_expense_account_id uuid,p_payment_account_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO 'public' AS $$
declare v_actor uuid := (select auth.uid()); v_expense_id uuid; v_journal_id uuid; v_entry_no bigint; v_expense numeric; v_vat numeric; v_total numeric; v_vat_account uuid;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
 v_expense:=p_amount; v_vat:=coalesce(p_vat_amount,0); v_total:=v_expense+v_vat;
 if coalesce(trim(p_category),'')='' or v_expense<=0 or v_vat<0 then raise exception 'invalid_expense'; end if;
 if p_branch_id is not null and not exists(select 1 from public.gmp_branches b where b.id=p_branch_id and b.organization_id=p_organization_id and b.active) then raise exception 'branch not found'; end if;
 if not exists(select 1 from public.gmp_accounts a where a.id=p_expense_account_id and a.organization_id=p_organization_id and a.active) then raise exception 'expense_account_not_found'; end if;
 if not exists(select 1 from public.gmp_accounts a where a.id=p_payment_account_id and a.organization_id=p_organization_id and a.active) then raise exception 'payment_account_not_found'; end if;
 select id into v_vat_account from public.gmp_accounts where organization_id=p_organization_id and system_key='vat_receivable' and active limit 1;
 if v_vat>0 and v_vat_account is null then raise exception 'VAT input account missing'; end if;
 insert into public.gmp_expenses(organization_id,branch_id,category,description,amount,vat_amount,expense_date,status,created_by)
 values(p_organization_id,p_branch_id,left(trim(p_category),120),nullif(left(coalesce(p_description,''),1000),''),v_expense,v_vat,coalesce(p_expense_date,current_date),'posted',v_actor)
 returning id into v_expense_id;
 insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by)
 values(p_organization_id,p_branch_id,'expense',v_expense_id,left('ترحيل مصروف: '||trim(p_category),500),coalesce(p_expense_date,current_date),'posted',v_actor)
 returning id,entry_no into v_journal_id,v_entry_no;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,p_expense_account_id,v_expense,0,'المصروف');
 if v_vat>0 then insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,v_vat_account,v_vat,0,'ضريبة مدخلات'); end if;
 insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_journal_id,p_payment_account_id,0,v_total,'الدفع');
 return jsonb_build_object('success',true,'expense_id',v_expense_id,'journal_id',v_journal_id,'entry_no',v_entry_no,'amount',v_expense,'vat_amount',v_vat,'total',v_total);
end; $$;
REVOKE ALL ON FUNCTION public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) TO authenticated;
