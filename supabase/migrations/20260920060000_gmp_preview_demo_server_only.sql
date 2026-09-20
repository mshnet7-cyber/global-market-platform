-- Preview Demo access is server-only.
-- The browser must never authenticate to GMP tables with a forgeable x-gmp-demo-role header.
-- Demo pages and APIs use the server-side demo cookie plus the service-role client.

do $migration$
declare
  t record;
  p record;
begin
  -- Revoke anonymous table access for every table currently protected by a preview-demo policy.
  -- This also cleans up policies introduced by earlier preview migrations that may no longer exist in Git.
  for t in
    select distinct schemaname, tablename
    from pg_policies
    where schemaname = 'public'
      and policyname like 'gmp_demo_preview_%'
  loop
    execute format('revoke all privileges on table %I.%I from anon', t.schemaname, t.tablename);
  end loop;

  -- Remove the forgeable-header demo policies themselves.
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname like 'gmp_demo_preview_%'
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$migration$;

-- These transaction functions are still callable by real authenticated users from the
-- server-side merchant API, but must never be callable directly by the anonymous role.
revoke execute on function public.gmp_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric) from anon;
revoke execute on function public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb) from anon;
revoke execute on function public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb) from anon;
revoke execute on function public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) from anon;
revoke execute on function public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb) from anon;
