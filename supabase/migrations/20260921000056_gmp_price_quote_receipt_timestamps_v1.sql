-- Preserve both source observation time and application receipt time for market quotes.
alter table public.gmp_price_quotes add column if not exists received_at timestamptz;
alter table public.gmp_price_snapshots add column if not exists received_at timestamptz;

update public.gmp_price_quotes
set received_at = coalesce(received_at, created_at)
where received_at is null;

update public.gmp_price_snapshots
set received_at = coalesce(received_at, created_at)
where received_at is null;

alter table public.gmp_price_quotes alter column received_at set default now();
alter table public.gmp_price_snapshots alter column received_at set default now();
