CREATE OR REPLACE FUNCTION public.gmp_void_expense(
  p_organization_id uuid,
  p_expense_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
declare
  v_actor uuid := (select auth.uid());
  v_expense public.gmp_expenses%rowtype;
  v_original public.gmp_journal_entries%rowtype;
  v_reversal uuid;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_line record;
  v_reason text := left(trim(coalesce(p_reason,'')),500);
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not authorized'; end if;
  if v_reason = '' then raise exception 'expense_id_and_reason_required'; end if;

  select * into v_expense
  from public.gmp_expenses
  where id=p_expense_id and organization_id=p_organization_id and status='posted'
  for update;
  if not found then raise exception 'expense_not_found_or_already_voided'; end if;

  select * into v_original
  from public.gmp_journal_entries
  where organization_id=p_organization_id and reference_type='expense' and reference_id=p_expense_id and status='posted'
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'expense_journal_missing'; end if;

  select coalesce(sum(debit),0), coalesce(sum(credit),0)
  into v_debit, v_credit
  from public.gmp_journal_lines
  where journal_entry_id=v_original.id;
  if abs(v_debit-v_credit) > 0.0005 then raise exception 'expense_journal_unbalanced'; end if;

  insert into public.gmp_journal_entries(
    organization_id, branch_id, reference_type, reference_id, description,
    entry_date, status, created_by
  ) values (
    p_organization_id, v_original.branch_id, 'expense_void', p_expense_id,
    'عكس مصروف: ' || v_reason, current_date, 'posted', v_actor
  ) returning id into v_reversal;

  for v_line in
    select account_id, debit, credit, memo
    from public.gmp_journal_lines
    where journal_entry_id=v_original.id
  loop
    insert into public.gmp_journal_lines(
      journal_entry_id, account_id, debit, credit, memo
    ) values (
      v_reversal, v_line.account_id, v_line.credit, v_line.debit,
      left(coalesce(v_line.memo,'') || ' — عكس قيد المصروف',500)
    );
  end loop;

  update public.gmp_expenses
  set status='voided', voided_at=now(), voided_by=v_actor, void_reason=v_reason
  where id=p_expense_id and organization_id=p_organization_id and status='posted';

  if abs((select coalesce(sum(debit),0)-coalesce(sum(credit),0) from public.gmp_journal_lines where journal_entry_id=v_reversal)) > 0.0005 then
    raise exception 'expense_reversal_unbalanced';
  end if;

  return jsonb_build_object(
    'success', true,
    'expense_id', p_expense_id,
    'original_journal_id', v_original.id,
    'reversal_journal_id', v_reversal
  );
end;
$$;

REVOKE ALL ON FUNCTION public.gmp_void_expense(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gmp_void_expense(uuid,uuid,text) TO authenticated;
