-- Stage 2 transaction RPCs: support the fixed Preview Demo actor without weakening tenant checks.
-- Real authenticated users continue to use auth.uid(); Demo is restricted to one fixed organization/user and shop_owner header.
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
      to_regprocedure('public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb)'),
      to_regprocedure('public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid)'),
      to_regprocedure('public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb)')
    )
  loop
    ddl := pg_get_functiondef(f.oid);
    ddl := replace(
      ddl,
      'v_actor uuid := (select auth.uid());',
      $$v_actor uuid := case
    when p_organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
      and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
    then '638b3213-67c6-4410-9e76-e44bbb7734f1'::uuid
    else (select auth.uid())
  end;$$
    );
    if ddl not like '%SECURITY DEFINER%' then
      ddl := replace(ddl, ' LANGUAGE plpgsql
 SET search_path TO ''public''', ' LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''');
    end if;
    execute ddl;
  end loop;
end;
$migration$;

grant execute on function public.gmp_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric) to anon;
grant execute on function public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb) to anon;
grant execute on function public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb) to anon;
grant execute on function public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) to anon;
grant execute on function public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb) to anon;

drop function if exists public.gmp_demo_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric);
drop function if exists public.gmp_demo_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb);
drop function if exists public.gmp_demo_create_purchase(uuid,uuid,uuid,uuid,text,jsonb);
drop function if exists public.gmp_demo_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid);
drop function if exists public.gmp_demo_create_manual_journal(uuid,uuid,text,date,jsonb);
drop function if exists public.gmp_preview_demo_guard(uuid);
