-- Remove the preview/demo actor identity bypass from sensitive SECURITY DEFINER RPCs.
-- Production authorization must always derive the actor from auth.uid().
DO $block$
DECLARE
  r record;
  v_def text;
  v_old text := $old$v_actor uuid := case
    when p_organization_id = 'b46e15af-2ffd-4775-b0d7-7d84fef4b749'::uuid
      and coalesce(auth.role(), '') = 'service_role'
      and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
    then '638b3213-67c6-4410-9e76-e44bbb7734f1'::uuid
    else (select auth.uid())
  end;$old$;
BEGIN
  FOR r IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public'
      AND p.proname IN (
        'gmp_create_and_post_sale',
        'gmp_create_purchase',
        'gmp_create_and_post_expense',
        'gmp_create_inventory_product',
        'gmp_create_manual_journal'
      )
      AND p.prosrc LIKE '%b46e15af-2ffd-4775-b0d7-7d84fef4b749%'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position(v_old in v_def)=0 THEN
      RAISE EXCEPTION 'expected demo actor block not found';
    END IF;
    EXECUTE replace(v_def,v_old,'v_actor uuid := (select auth.uid());');
  END LOOP;
END $block$;

REVOKE ALL ON FUNCTION public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.gmp_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric) FROM anon;
REVOKE ALL ON FUNCTION public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb) FROM anon;
