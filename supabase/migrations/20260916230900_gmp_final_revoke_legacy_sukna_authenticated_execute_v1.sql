-- Final deny boundary for legacy Sukna SECURITY DEFINER RPCs. Keep service_role access only where required for legacy maintenance.
revoke execute on function public.sukna_bootstrap_org(text) from anon, authenticated, public;
revoke execute on function public.sukna_create_order_tx_v2(uuid, uuid, uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric, jsonb, text) from anon, authenticated, public;
revoke execute on function public.sukna_is_member(uuid) from anon, authenticated, public;
revoke execute on function public.sukna_post_expense_tx_v1(uuid, text, numeric, text, date, text) from anon, authenticated, public;
revoke execute on function public.sukna_post_manual_payment_tx_v1(uuid, uuid, uuid, text, text, numeric, text, text) from anon, authenticated, public;
revoke execute on function public.sukna_post_purchase_tx_v1(uuid, uuid, uuid, text, uuid, numeric, text, numeric, text, text, text) from anon, authenticated, public;
revoke execute on function public.sukna_post_sale_tx_v2(uuid, uuid, uuid, numeric, numeric, jsonb, text, text, text) from anon, authenticated, public;
revoke execute on function public.sukna_receive_purchase_tx_v2(uuid, uuid, uuid, numeric, text) from anon, authenticated, public;
revoke execute on function public.sukna_release_order_reservation_tx_v1(uuid, uuid) from anon, authenticated, public;
revoke execute on function public.sukna_reserve_order_tx_v1(uuid, uuid) from anon, authenticated, public;
revoke execute on function public.sukna_transition_order_tx_v1(uuid, uuid, text) from anon, authenticated, public;
