-- Bind Preview Demo actor override to the service-role client.
-- Real authenticated callers always fall back to auth.uid(); a forgeable
-- x-gmp-demo-role header alone can no longer impersonate the seeded demo actor.

do $migration$
declare
  f record;
  ddl text;
  old_clause text := $$when p_organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
      and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'$$;
  new_clause text := $$when p_organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
      and coalesce(auth.role(), '') = 'service_role'
      and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'$$;
  updated_count integer := 0;
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
    if position(old_clause in ddl) = 0 then
      raise exception 'demo_actor_guard_pattern_not_found:%', f.oid::text;
    end if;
    ddl := replace(ddl, old_clause, new_clause);
    execute ddl;
    updated_count := updated_count + 1;
  end loop;

  if updated_count <> 5 then
    raise exception 'expected_5_stage2_transaction_functions_updated:%', updated_count;
  end if;
end
$migration$;
