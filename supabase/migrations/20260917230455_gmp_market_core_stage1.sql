create table if not exists public.gmp_market_alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.gmp_organizations(id) on delete cascade,
  instrument_code text not null,
  provider_code text,
  rule_type text not null check (rule_type in ('price_above','price_below','change_pct_above','change_pct_below','source_unavailable')),
  threshold numeric,
  cooldown_minutes integer not null default 30 check (cooldown_minutes between 1 and 1440),
  channels jsonb not null default '["in_app"]'::jsonb,
  active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rule_type = 'source_unavailable' or threshold is not null)
);
create index if not exists gmp_market_alert_rules_user_idx on public.gmp_market_alert_rules(user_id,created_at desc);
create index if not exists gmp_market_alert_rules_instrument_idx on public.gmp_market_alert_rules(instrument_code,active);

create table if not exists public.gmp_api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['market:read']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gmp_api_keys_org_idx on public.gmp_api_keys(organization_id,created_at desc);

create table if not exists public.gmp_api_rate_buckets (
  api_key_id uuid not null references public.gmp_api_keys(id) on delete cascade,
  bucket_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (api_key_id,bucket_start)
);

create or replace function public.gmp_consume_api_rate_limit(p_key_id uuid,p_limit integer,p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket timestamptz;
  v_hits integer;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    return false;
  end if;
  v_bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.gmp_api_rate_buckets(api_key_id,bucket_start,hits)
  values (p_key_id,v_bucket,1)
  on conflict (api_key_id,bucket_start)
  do update set hits = public.gmp_api_rate_buckets.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

grant execute on function public.gmp_consume_api_rate_limit(uuid,integer,integer) to anon,authenticated,service_role;

create table if not exists public.gmp_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  url text not null,
  event_types text[] not null default array['market.alert.triggered']::text[],
  secret_ciphertext text not null,
  secret_hint text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gmp_webhook_endpoints_org_idx on public.gmp_webhook_endpoints(organization_id,enabled);

create table if not exists public.gmp_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.gmp_webhook_endpoints(id) on delete cascade,
  event_id uuid not null,
  event_type text not null,
  status_code integer,
  ok boolean not null default false,
  attempts integer not null default 0,
  error_message text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(endpoint_id,event_id)
);
create index if not exists gmp_webhook_deliveries_endpoint_idx on public.gmp_webhook_deliveries(endpoint_id,created_at desc);

alter table public.gmp_market_alert_rules enable row level security;
alter table public.gmp_api_keys enable row level security;
alter table public.gmp_api_rate_buckets enable row level security;
alter table public.gmp_webhook_endpoints enable row level security;
alter table public.gmp_webhook_deliveries enable row level security;

drop policy if exists gmp_market_alert_rules_self on public.gmp_market_alert_rules;
create policy gmp_market_alert_rules_self on public.gmp_market_alert_rules
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists gmp_api_keys_admin on public.gmp_api_keys;
create policy gmp_api_keys_admin on public.gmp_api_keys
for all to authenticated
using (exists (
  select 1 from public.gmp_organization_members m
  where m.organization_id = gmp_api_keys.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.gmp_organization_members m
  where m.organization_id = gmp_api_keys.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
));

drop policy if exists gmp_webhook_endpoints_admin on public.gmp_webhook_endpoints;
create policy gmp_webhook_endpoints_admin on public.gmp_webhook_endpoints
for all to authenticated
using (exists (
  select 1 from public.gmp_organization_members m
  where m.organization_id = gmp_webhook_endpoints.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
))
with check (exists (
  select 1 from public.gmp_organization_members m
  where m.organization_id = gmp_webhook_endpoints.organization_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
));

drop policy if exists gmp_webhook_deliveries_admin_read on public.gmp_webhook_deliveries;
create policy gmp_webhook_deliveries_admin_read on public.gmp_webhook_deliveries
for select to authenticated
using (exists (
  select 1
  from public.gmp_webhook_endpoints e
  join public.gmp_organization_members m on m.organization_id = e.organization_id
  where e.id = gmp_webhook_deliveries.endpoint_id
    and m.user_id = (select auth.uid())
    and m.role in ('owner','admin')
));

insert into public.gmp_data_providers(code,name,enabled,commercial_use,public_display,customer_display,redistribution,realtime)
values
('alpha_vantage','Alpha Vantage',true,false,false,false,false,false),
('eodhd','EODHD',true,false,false,false,false,false),
('marketaux','Marketaux',true,false,true,true,false,false),
('newsdata','NewsData.io',true,false,true,true,false,false)
on conflict(code) do nothing;

insert into public.gmp_instruments(code,name,asset_type)
values
('AAPL','Apple','stock'),('MSFT','Microsoft','stock'),('NVDA','NVIDIA','stock'),('AMZN','Amazon','stock'),
('GOOGL','Alphabet','stock'),('META','Meta Platforms','stock'),('TSLA','Tesla','stock'),('JPM','JPMorgan Chase','stock'),
('KO','Coca-Cola','stock'),('XOM','Exxon Mobil','stock'),
('SPY','S&P 500 ETF','market'),('QQQ','Nasdaq-100 ETF','market'),('DIA','Dow Jones ETF','market'),('EWJ','Japan ETF','market')
on conflict(code) do nothing;

create index if not exists gmp_price_quotes_instrument_observed_idx on public.gmp_price_quotes(instrument_code,observed_at desc);
create index if not exists gmp_price_quotes_observed_idx on public.gmp_price_quotes(observed_at desc);
