-- Applied to production Supabase.
CREATE OR REPLACE FUNCTION public.gmp_create_manual_journal(p_organization_id uuid,p_branch_id uuid,p_description text,p_entry_date date,p_lines jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
declare v_actor uuid := (select auth.uid()); v_entry_id uuid; v_entry_no bigint; v_debit numeric:=0; v_credit numeric:=0; v_line jsonb; v_account uuid; v_d numeric; v_c numeric;
begin
 if v_actor is null then raise exception 'authentication required'; end if;
 if not exists(select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
 if coalesce(trim(p_description),'')='' or p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then raise exception 'journal_required'; end if;
 for v_line in select value from jsonb_array_elements(p_lines) loop
   v_account := (v_line->>'account_id')::uuid; v_d:=coalesce(nullif(v_line->>'debit','')::numeric,0); v_c:=coalesce(nullif(v_line->>'credit','')::numeric,0);
   if v_account is null or v_d<0 or v_c<0 or (v_d>0 and v_c>0) or (v_d=0 and v_c=0) then raise exception 'invalid_journal_line'; end if;
   if not exists(select 1 from public.gmp_accounts a where a.id=v_account and a.organization_id=p_organization_id and a.active) then raise exception 'account_not_found'; end if;
   v_debit:=v_debit+v_d; v_credit:=v_credit+v_c;
 end loop;
 if abs(v_debit-v_credit)>0.0005 then raise exception 'journal_not_balanced'; end if;
 insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,description,entry_date,status,created_by) values(p_organization_id,p_branch_id,'manual',trim(p_description),coalesce(p_entry_date,current_date),'posted',v_actor) returning id,entry_no into v_entry_id,v_entry_no;
 for v_line in select value from jsonb_array_elements(p_lines) loop
   insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo) values(v_entry_id,(v_line->>'account_id')::uuid,coalesce(nullif(v_line->>'debit','')::numeric,0),coalesce(nullif(v_line->>'credit','')::numeric,0),nullif(trim(v_line->>'memo'),'') );
 end loop;
 return jsonb_build_object('success',true,'entry_id',v_entry_id,'entry_no',v_entry_no);
end;
$$;
REVOKE ALL ON FUNCTION public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb) TO authenticated;

ALTER TABLE public.gmp_expenses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted';
ALTER TABLE public.gmp_expenses ADD COLUMN IF NOT EXISTS voided_at timestamptz;
ALTER TABLE public.gmp_expenses ADD COLUMN IF NOT EXISTS voided_by uuid;
ALTER TABLE public.gmp_expenses ADD COLUMN IF NOT EXISTS void_reason text;
ALTER TABLE public.gmp_expenses DROP CONSTRAINT IF EXISTS gmp_expenses_status_check;
ALTER TABLE public.gmp_expenses ADD CONSTRAINT gmp_expenses_status_check CHECK (status in ('posted','voided'));
