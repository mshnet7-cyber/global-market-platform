-- Fix formatting variant in the inventory-product RPC actor declaration.
do $migration$
declare
  oidv oid;
  ddl text;
begin
  oidv := to_regprocedure('public.gmp_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric)');
  if oidv is null then raise exception 'product_function_not_found'; end if;
  ddl := pg_get_functiondef(oidv);
  ddl := replace(
    ddl,
    'v_actor uuid:=(select auth.uid());',
    $$v_actor uuid := case
    when p_organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
      and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
    then '638b3213-67c6-4410-9e76-e44bbb7734f1'::uuid
    else (select auth.uid())
  end;$$
  );
  execute ddl;
end;
$migration$;
