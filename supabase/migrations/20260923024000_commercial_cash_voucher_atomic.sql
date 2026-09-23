-- Atomic cash-voucher creation and collision-free numbering.
create or replace function public.gmp_create_cash_voucher(
  p_organization_id uuid,
  p_branch_id uuid,
  p_voucher_type text,
  p_party_type text,
  p_customer_id uuid,
  p_supplier_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference text,
  p_notes text,
  p_voucher_date date
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  voucher_row public.gmp_cash_vouchers%rowtype;
  prefix text;
  voucher_no text;
  next_no integer;
  effective_date date := coalesce(p_voucher_date,current_date);
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  ) then raise exception 'organization_write_forbidden'; end if;

  if p_voucher_type not in ('receipt','payment') then raise exception 'voucher_type_required'; end if;
  if p_party_type not in ('customer','supplier','other') then raise exception 'party_type_required'; end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'amount_required'; end if;

  if p_branch_id is not null and not exists (
    select 1 from public.gmp_branches b
    where b.id=p_branch_id and b.organization_id=p_organization_id
  ) then raise exception 'branch_not_found'; end if;

  if p_party_type='customer' then
    if p_customer_id is null or not exists (
      select 1 from public.gmp_customers c
      where c.id=p_customer_id and c.organization_id=p_organization_id
    ) then raise exception 'customer_not_found'; end if;
  elsif p_party_type='supplier' then
    if p_supplier_id is null or not exists (
      select 1 from public.gmp_suppliers s
      where s.id=p_supplier_id and s.organization_id=p_organization_id
    ) then raise exception 'supplier_not_found'; end if;
  end if;

  -- Serialize numbering per organization/day/type so concurrent requests
  -- cannot generate the same human-facing voucher number.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'gmp-cash-voucher:' || p_organization_id::text || ':' ||
      effective_date::text || ':' || p_voucher_type,
      0
    )
  );

  prefix := case when p_voucher_type='receipt' then 'RV-' else 'PV-' end
    || to_char(effective_date,'YYYYMMDD') || '-';

  select coalesce(max(
    case
      when voucher_no ~ ('^' || prefix || '[0-9]+$')
      then right(voucher_no, greatest(length(voucher_no)-length(prefix),1))::integer
      else null
    end
  ),0) + 1
  into next_no
  from public.gmp_cash_vouchers
  where organization_id=p_organization_id
    and voucher_type=p_voucher_type
    and voucher_date=effective_date;

  voucher_no := prefix || lpad(next_no::text,6,'0');

  insert into public.gmp_cash_vouchers(
    organization_id,branch_id,voucher_no,voucher_type,party_type,
    customer_id,supplier_id,amount,payment_method,reference,notes,
    voucher_date,status,created_by
  ) values (
    p_organization_id,p_branch_id,voucher_no,p_voucher_type,p_party_type,
    case when p_party_type='customer' then p_customer_id else null end,
    case when p_party_type='supplier' then p_supplier_id else null end,
    p_amount,coalesce(nullif(trim(p_payment_method),''),'cash'),
    nullif(trim(p_reference),''),nullif(trim(p_notes),''),
    effective_date,'posted',(select auth.uid())
  ) returning * into voucher_row;

  return jsonb_build_object('voucher',to_jsonb(voucher_row),'voucher_id',voucher_row.id,'voucher_no',voucher_row.voucher_no);
end;
$function$;

revoke all on function public.gmp_create_cash_voucher(uuid,uuid,text,text,uuid,uuid,numeric,text,text,text,date) from public,anon,authenticated;
grant execute on function public.gmp_create_cash_voucher(uuid,uuid,text,text,uuid,uuid,numeric,text,text,text,date) to authenticated;
