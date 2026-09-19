-- Remove the remaining exact duplicate of the constraint-backed marketplace idempotency index.
drop index if exists public.gmp_marketplace_orders_store_id_idempotency_idx;
