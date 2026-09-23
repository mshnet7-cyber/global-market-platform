-- Harden SECURITY DEFINER RPCs against search_path hijacking.
-- These RPCs are intentionally callable by authenticated merchant admins,
-- so keep authenticated EXECUTE and remove only mutable search_path resolution.
alter function public.gmp_complete_manufacturing(uuid,numeric,numeric,numeric,numeric,text) set search_path = '';
alter function public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) set search_path = '';
alter function public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb) set search_path = '';
alter function public.gmp_create_gold_buyback(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text) set search_path = '';
alter function public.gmp_create_gold_exchange(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,text) set search_path = '';
alter function public.gmp_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric) set search_path = '';
alter function public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb) set search_path = '';
alter function public.gmp_create_manufacturing_order(uuid,uuid,uuid,uuid,numeric,numeric,jsonb,text) set search_path = '';
alter function public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb) set search_path = '';
alter function public.gmp_process_repair(uuid,text,uuid,text,text) set search_path = '';
alter function public.gmp_receive_purchase(uuid,jsonb,text) set search_path = '';

revoke execute on function public.gmp_complete_manufacturing(uuid,numeric,numeric,numeric,numeric,text) from anon;
revoke execute on function public.gmp_create_and_post_expense(uuid,uuid,text,text,numeric,numeric,date,uuid,uuid) from anon;
revoke execute on function public.gmp_create_and_post_sale(uuid,uuid,uuid,uuid,text,text,jsonb) from anon;
revoke execute on function public.gmp_create_gold_buyback(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,text,text) from anon;
revoke execute on function public.gmp_create_gold_exchange(uuid,uuid,uuid,uuid,uuid,numeric,numeric,numeric,numeric,uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,text) from anon;
revoke execute on function public.gmp_create_inventory_product(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric) from anon;
revoke execute on function public.gmp_create_manual_journal(uuid,uuid,text,date,jsonb) from anon;
revoke execute on function public.gmp_create_manufacturing_order(uuid,uuid,uuid,uuid,numeric,numeric,jsonb,text) from anon;
revoke execute on function public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb) from anon;
revoke execute on function public.gmp_process_repair(uuid,text,uuid,text,text) from anon;
revoke execute on function public.gmp_receive_purchase(uuid,jsonb,text) from anon;
