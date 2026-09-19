-- P0 security: public marketplace order creation must only be callable through the rate-limited server route.
revoke execute on function public.gmp_create_marketplace_order(uuid,text,text,text,text,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.gmp_create_marketplace_order(uuid,text,text,text,text,jsonb,text,text) to service_role;
