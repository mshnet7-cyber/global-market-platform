-- Gold SaaS domain foundation: immutable gold ledger + price rules.
-- Additive only. No changes to existing POS/accounting business logic.
-- The ledger records the physical gold position separately from the accounting ledger.

create table if not exists public.gmp_gold_price_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  store_id uuid references public.gmp_stores(id) on delete cascade,
  karat numeric(6,3) not null check (karat > 0 and karat <= 24),
  side text not null check (side in ('buy','sell')),
  adjustment_type text not null default 'fixed_per_gram'
    check (adjustment_type in ('fixed_per_gram','percentage')),
  adjustment_value numeric(18,6) not null default 0,
  making_charge_per_gram numeric(18,6) not null default 0 check (making_charge_per_gram >= 0),
  min_margin_per_gram numeric(18,6) not null default 0 check (min_margin_per_gram >= 0),
  rounding_scale smallint not null default 3 check (rounding_scale between 0 and 6),
  active boolean not null default true,
  priority integer not null default 100,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  check (adjustment_type <> 'percentage' or adjustment_value between -100 and 1000)
);

create index if not exists gmp_gold_price_rules_scope_idx
  on public.gmp_gold_price_rules(organization_id,store_id,karat,side,active,priority);

create table if not exists public.gmp_gold_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  branch_id uuid references public.gmp_branches(id) on delete restrict,
  store_id uuid not null references public.gmp_stores(id) on delete restrict,
  product_id uuid references public.gmp_products(id) on delete set null,
  operation_type text not null check (
    operation_type in (
      'purchase','sale','sale_return','purchase_return','transfer_in','transfer_out',
      'buyback','exchange_in','exchange_out','manufacture_in','manufacture_out',
      'repair_in','repair_out','adjustment'
    )
  ),
  direction text not null check (direction in ('in','out')),
  reference_type text,
  reference_id uuid,
  idempotency_key text,
  karat numeric(6,3) not null check (karat > 0 and karat <= 24),
  gross_weight_grams numeric(20,6) not null check (gross_weight_grams >= 0),
  stone_weight_grams numeric(20,6) not null default 0 check (stone_weight_grams >= 0),
  net_weight_grams numeric(20,6) not null check (net_weight_grams >= 0 and net_weight_grams <= gross_weight_grams),
  pure_gold_weight_grams numeric(20,6) generated always as (round(net_weight_grams * karat / 24, 6)) stored,
  unit_value numeric(20,6) not null default 0 check (unit_value >= 0),
  making_charge numeric(20,6) not null default 0 check (making_charge >= 0),
  total_value numeric(20,6) not null default 0 check (total_value >= 0),
  currency char(3) not null default 'OMR',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gmp_gold_ledger_idempotency_uniq unique (organization_id,idempotency_key)
);

create index if not exists gmp_gold_ledger_org_created_idx
  on public.gmp_gold_ledger_entries(organization_id,created_at desc);
create index if not exists gmp_gold_ledger_store_karat_idx
  on public.gmp_gold_ledger_entries(store_id,karat,created_at desc);
create index if not exists gmp_gold_ledger_product_idx
  on public.gmp_gold_ledger_entries(product_id,created_at desc);
create index if not exists gmp_gold_ledger_reference_idx
  on public.gmp_gold_ledger_entries(reference_type,reference_id);

drop trigger if exists gmp_gold_price_rules_updated_at on public.gmp_gold_price_rules;
create trigger gmp_gold_price_rules_updated_at
before update on public.gmp_gold_price_rules
for each row execute function public.gmp_set_updated_at();

alter table public.gmp_gold_price_rules enable row level security;
alter table public.gmp_gold_ledger_entries enable row level security;

drop policy if exists gmp_gold_price_rules_member_read on public.gmp_gold_price_rules;
create policy gmp_gold_price_rules_member_read on public.gmp_gold_price_rules
for select to authenticated using (
  exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=gmp_gold_price_rules.organization_id
      and m.user_id=(select auth.uid())
  )
);

drop policy if exists gmp_gold_price_rules_admin_write on public.gmp_gold_price_rules;
create policy gmp_gold_price_rules_admin_write on public.gmp_gold_price_rules
for all to authenticated using (
  exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=gmp_gold_price_rules.organization_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  )
) with check (
  exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=gmp_gold_price_rules.organization_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  )
);

drop policy if exists gmp_gold_ledger_member_read on public.gmp_gold_ledger_entries;
create policy gmp_gold_ledger_member_read on public.gmp_gold_ledger_entries
for select to authenticated using (
  exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=gmp_gold_ledger_entries.organization_id
      and m.user_id=(select auth.uid())
  )
);

drop policy if exists gmp_gold_ledger_admin_insert on public.gmp_gold_ledger_entries;
create policy gmp_gold_ledger_admin_insert on public.gmp_gold_ledger_entries
for insert to authenticated with check (
  exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=gmp_gold_ledger_entries.organization_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  )
);

create or replace function public.gmp_post_gold_ledger_entry(
  p_organization_id uuid,
  p_branch_id uuid,
  p_store_id uuid,
  p_product_id uuid,
  p_operation_type text,
  p_direction text,
  p_reference_type text,
  p_reference_id uuid,
  p_idempotency_key text,
  p_karat numeric,
  p_gross_weight_grams numeric,
  p_stone_weight_grams numeric,
  p_net_weight_grams numeric,
  p_unit_value numeric,
  p_making_charge numeric,
  p_total_value numeric,
  p_currency text default 'OMR',
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_actor uuid := (select auth.uid());
  v_entry public.gmp_gold_ledger_entries%rowtype;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=v_actor
      and m.role in ('owner','admin')
  ) then raise exception 'not authorized'; end if;

  if p_karat <= 0 or p_karat > 24 then raise exception 'invalid_karat'; end if;
  if p_gross_weight_grams < 0 or p_stone_weight_grams < 0 or p_net_weight_grams < 0 then raise exception 'invalid_weight'; end if;
  if p_net_weight_grams > p_gross_weight_grams then raise exception 'net_weight_exceeds_gross'; end if;
  if p_unit_value < 0 or p_making_charge < 0 or p_total_value < 0 then raise exception 'invalid_value'; end if;
  if p_operation_type not in ('purchase','sale','sale_return','purchase_return','transfer_in','transfer_out','buyback','exchange_in','exchange_out','manufacture_in','manufacture_out','repair_in','repair_out','adjustment') then raise exception 'invalid_operation_type'; end if;
  if p_direction not in ('in','out') then raise exception 'invalid_direction'; end if;
  if p_currency is null or length(trim(p_currency)) <> 3 then raise exception 'invalid_currency'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'invalid_metadata'; end if;

  if p_idempotency_key is not null then
    select * into v_entry
    from public.gmp_gold_ledger_entries
    where organization_id=p_organization_id and idempotency_key=p_idempotency_key
    limit 1;
    if found then
      return jsonb_build_object('success',true,'entry_id',v_entry.id,'idempotent',true);
    end if;
  end if;

  insert into public.gmp_gold_ledger_entries(
    organization_id,branch_id,store_id,product_id,operation_type,direction,
    reference_type,reference_id,idempotency_key,karat,gross_weight_grams,
    stone_weight_grams,net_weight_grams,unit_value,making_charge,total_value,
    currency,metadata,created_by
  ) values (
    p_organization_id,p_branch_id,p_store_id,p_product_id,p_operation_type,p_direction,
    nullif(trim(p_reference_type),''),p_reference_id,nullif(trim(p_idempotency_key),''),
    p_karat,p_gross_weight_grams,p_stone_weight_grams,p_net_weight_grams,
    p_unit_value,p_making_charge,p_total_value,upper(trim(p_currency)),p_metadata,v_actor
  ) returning * into v_entry;

  return jsonb_build_object(
    'success',true,
    'entry_id',v_entry.id,
    'idempotent',false,
    'pure_gold_weight_grams',v_entry.pure_gold_weight_grams
  );
end;
$$;

revoke all on function public.gmp_post_gold_ledger_entry(
  uuid,uuid,uuid,uuid,text,text,text,uuid,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,jsonb
) from public,anon;
grant execute on function public.gmp_post_gold_ledger_entry(
  uuid,uuid,uuid,uuid,text,text,text,uuid,text,numeric,numeric,numeric,numeric,numeric,numeric,numeric,text,jsonb
) to authenticated;

create or replace view public.gmp_gold_store_balances as
select
  organization_id,
  store_id,
  karat,
  sum(case when direction='in' then net_weight_grams else -net_weight_grams end) as net_weight_grams,
  sum(case when direction='in' then pure_gold_weight_grams else -pure_gold_weight_grams end) as pure_gold_weight_grams,
  sum(case when direction='in' then total_value else -total_value end) as inventory_value,
  max(currency) as currency
from public.gmp_gold_ledger_entries
group by organization_id,store_id,karat;
