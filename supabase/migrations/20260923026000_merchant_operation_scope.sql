-- Enforce tenant scope for merchant operation rows at the database boundary.
create or replace function public.gmp_validate_merchant_operation_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_org uuid;
begin
  if tg_table_name = 'gmp_repair_orders' then
    if new.branch_id is not null then
      select b.organization_id into v_org from public.gmp_branches b where b.id = new.branch_id;
      if v_org is null or v_org <> new.organization_id then
        raise exception 'branch_organization_mismatch';
      end if;
    end if;

    if new.customer_id is not null then
      select c.organization_id into v_org from public.gmp_customers c where c.id = new.customer_id;
      if v_org is null or v_org <> new.organization_id then
        raise exception 'customer_organization_mismatch';
      end if;
    end if;

    if new.store_id is not null then
      select s.organization_id into v_org from public.gmp_stores s where s.id = new.store_id;
      if v_org is null or v_org <> new.organization_id then
        raise exception 'store_organization_mismatch';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'gmp_person_gold_purchases' then
    if new.branch_id is not null then
      select b.organization_id into v_org from public.gmp_branches b where b.id = new.branch_id;
      if v_org is null or v_org <> new.organization_id then
        raise exception 'branch_organization_mismatch';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$function$;

drop trigger if exists gmp_repair_orders_scope_trg on public.gmp_repair_orders;
create trigger gmp_repair_orders_scope_trg
before insert or update on public.gmp_repair_orders
for each row execute function public.gmp_validate_merchant_operation_scope();

drop trigger if exists gmp_person_gold_purchases_scope_trg on public.gmp_person_gold_purchases;
create trigger gmp_person_gold_purchases_scope_trg
before insert or update on public.gmp_person_gold_purchases
for each row execute function public.gmp_validate_merchant_operation_scope();

revoke all on function public.gmp_validate_merchant_operation_scope() from public, anon, authenticated;