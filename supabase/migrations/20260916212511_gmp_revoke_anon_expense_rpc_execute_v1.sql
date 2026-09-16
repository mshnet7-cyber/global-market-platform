-- Prevent unauthenticated callers from executing the merchant expense posting RPC.
REVOKE EXECUTE ON FUNCTION public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) FROM anon;
