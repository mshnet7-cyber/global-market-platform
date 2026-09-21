-- Stage 2 compatibility fix: gmp_stores has no active column.
-- Keep store eligibility scoped by organization; store activity is not stored on this table.
do $migration$
declare
  f record;
  ddl text;
begin
  for f in
    select oid
    from pg_proc
    where oid in (
      to_regprocedure('public.gmp_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric)'),
      to_regprocedure('public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb)'),
      to_regprocedure('public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb)')
    )
  loop
    ddl := pg_get_functiondef(f.oid);
    ddl := replace(
      ddl,
      'from public.gmp_stores where id=p_store_id and organization_id=p_organization_id and active=true;',
      'from public.gmp_stores where id=p_store_id and organization_id=p_organization_id;'
    );
    ddl := replace(
      ddl,
      'from public.gmp_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.active=true;',
      'from public.gmp_stores s where s.id=p_store_id and s.organization_id=p_organization_id;'
    );
    execute ddl;
  end loop;
end;
$migration$;
