-- Remove exact duplicate non-constraint indexes discovered by pg_indexes.
-- Constraint-backed UNIQUE/PRIMARY KEY indexes are intentionally retained.
drop index if exists public.idx_assignment_items_assignment;
drop index if exists public.gmp_customers_phone_idx;
drop index if exists public.gmp_marketplace_orders_store_idempotency_idx;
drop index if exists public.idx_gmp_news_sources_id;
drop index if exists public.idx_gmp_provider_status_provider_id;
drop index if exists public.idx_gmp_store_settings_store_id;
drop index if exists public.idx_gmp_subscriptions_organization_id;
drop index if exists public.lessons_unit_order_idx;
