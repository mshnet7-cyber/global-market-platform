-- Stage 2 compatibility fix: gmp_suppliers has no active column.
do $migration$
declare
  oidv oid;
  ddl text;
begin
  oidv := to_regprocedure('public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb)');
  if oidv is null then raise exception 'purchase_function_not_found'; end if;
  ddl := pg_get_functiondef(oidv);
  ddl := replace(
    ddl,
    'p_supplier_id is not null and not exists(select 1 from public.gmp_suppliers s where s.id=p_supplier_id and s.organization_id=p_organization_id and s.active=true)',
    'p_supplier_id is not null and not exists(select 1 from public.gmp_suppliers s where s.id=p_supplier_id and s.organization_id=p_organization_id)'
  );
  execute ddl;
end;
$migration$;
