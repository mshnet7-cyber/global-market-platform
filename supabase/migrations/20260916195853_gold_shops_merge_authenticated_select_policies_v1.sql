DROP POLICY IF EXISTS gold_shops_owner_select ON public.gold_shops;
DROP POLICY IF EXISTS gold_shops_platform_admin_select ON public.gold_shops;
CREATE POLICY gold_shops_authenticated_select ON public.gold_shops
FOR SELECT TO authenticated
USING (
  (select auth.uid()) = owner_user_id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = (select auth.uid())
      AND p.role = 'platform_admin'::app_role
  )
);
