-- Keep the API rate-limit RPC server-side only.
revoke execute on function public.gmp_consume_api_rate_limit(uuid,integer,integer) from public;
grant execute on function public.gmp_consume_api_rate_limit(uuid,integer,integer) to service_role;