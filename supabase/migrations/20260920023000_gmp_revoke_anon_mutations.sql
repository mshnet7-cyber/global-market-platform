-- Least-privilege hardening for the public API role.
-- GMP browser writes are performed through authenticated server routes/RPCs.
-- Public-facing reads remain available where explicitly granted by RLS policies.
do $migration$
declare
  t record;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname like 'gmp_%'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on table %I.%I from anon',
      t.schema_name,
      t.table_name
    );
  end loop;
end;
$migration$;
