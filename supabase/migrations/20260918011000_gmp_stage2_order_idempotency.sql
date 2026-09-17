-- Stage 2: make the payment-free marketplace request idempotency boundary race-safe.
create unique index if not exists gmp_marketplace_orders_store_idempotency_uq
on public.gmp_marketplace_orders(store_id,idempotency_key)
where idempotency_key is not null;