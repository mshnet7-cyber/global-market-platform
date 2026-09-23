-- Harden remaining public SECURITY DEFINER GMP helpers against search_path hijacking.
-- Applied in production as migration 20260923085128.
alter function public.gmp_allow_display_pairing_attempt(text,timestamptz) set search_path='';
alter function public.gmp_allow_public_marketplace_order(text,timestamptz) set search_path='';
alter function public.gmp_bootstrap_account(uuid,text,text,text,text,text,text,text) set search_path='';
alter function public.gmp_claim_billing_event(uuid,uuid,text,text,text,text) set search_path='';
alter function public.gmp_claim_due_webhook_deliveries(integer) set search_path='';
alter function public.gmp_claim_due_whatsapp_messages(integer) set search_path='';
alter function public.gmp_claim_einvoice_send(uuid,uuid) set search_path='';
alter function public.gmp_claim_market_alert(uuid,integer,timestamptz) set search_path='';
alter function public.gmp_consume_api_rate_limit(uuid,integer,integer) set search_path='';
alter function public.gmp_consume_pairing_code(text,text,timestamptz,timestamptz) set search_path='';
alter function public.gmp_create_marketplace_order(uuid,text,text,text,text,jsonb,text,text) set search_path='';
alter function public.gmp_create_store(uuid,text,text,text,text,text) set search_path='';
alter function public.gmp_document_review(uuid,text,uuid) set search_path='';
alter function public.gmp_issue_pairing_code(uuid,text,timestamptz,timestamptz) set search_path='';
alter function public.gmp_seed_default_accounts() set search_path='';
alter function public.gmp_stage2_validate_reference_scope() set search_path='';
alter function public.gmp_stage3_validate_scope() set search_path='';
