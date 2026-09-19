-- Reconcile live migration history; the index is already absent, so this is intentionally idempotent.
drop index if exists public.gmp_marketplace_orders_store_id_idempotency_idx;
