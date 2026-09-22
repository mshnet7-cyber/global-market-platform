-- Merchant commercial completeness: quotations, receipt/payment vouchers, price lists
create table if not exists public.gmp_sales_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  store_id uuid not null references public.gmp_stores(id) on delete restrict,
  branch_id uuid references public.gmp_branches(id) on delete set null,
  customer_id uuid references public.gmp_customers(id) on delete set null,
  quote_no text not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','converted','cancelled')),
  valid_until date,
  currency text not null default 'OMR',
  subtotal numeric(20,3) not null default 0,
  discount_amount numeric(20,3) not null default 0,
  vat_amount numeric(20,3) not null default 0,
  total numeric(20,3) not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_no)
);
create table if not exists public.gmp_sales_quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.gmp_sales_quotes(id) on delete cascade,
  product_id uuid references public.gmp_products(id) on delete set null,
  description text not null,
  quantity numeric(20,3) not null default 1,
  weight_grams numeric(20,3) not null default 0,
  unit_price numeric(20,3) not null default 0,
  making_charge numeric(20,3) not null default 0,
  discount_amount numeric(20,3) not null default 0,
  vat_amount numeric(20,3) not null default 0,
  line_total numeric(20,3) not null default 0
);
create table if not exists public.gmp_cash_vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  branch_id uuid references public.gmp_branches(id) on delete set null,
  voucher_no text not null,
  voucher_type text not null check (voucher_type in ('receipt','payment')),
  party_type text check (party_type in ('customer','supplier','other')),
  customer_id uuid references public.gmp_customers(id) on delete set null,
  supplier_id uuid references public.gmp_suppliers(id) on delete set null,
  amount numeric(20,3) not null check (amount > 0),
  payment_method text not null default 'cash',
  reference text,
  notes text,
  voucher_date date not null default current_date,
  status text not null default 'posted' check (status in ('draft','posted','cancelled')),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id, voucher_no)
);
create table if not exists public.gmp_price_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  store_id uuid references public.gmp_stores(id) on delete cascade,
  name text not null,
  currency text not null default 'OMR',
  active boolean not null default true,
  valid_from date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.gmp_price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.gmp_price_lists(id) on delete cascade,
  product_id uuid not null references public.gmp_products(id) on delete cascade,
  sell_price numeric(20,3),
  buy_price numeric(20,3),
  making_charge numeric(20,3) not null default 0,
  min_quantity numeric(20,3),
  max_quantity numeric(20,3),
  unique(price_list_id, product_id)
);

create index if not exists gmp_sales_quotes_org_created_idx on public.gmp_sales_quotes(organization_id, created_at desc);
create index if not exists gmp_sales_quote_lines_quote_idx on public.gmp_sales_quote_lines(quote_id);
create index if not exists gmp_cash_vouchers_org_date_idx on public.gmp_cash_vouchers(organization_id, voucher_date desc);
create index if not exists gmp_price_lists_org_idx on public.gmp_price_lists(organization_id, active);
create index if not exists gmp_price_list_items_list_idx on public.gmp_price_list_items(price_list_id);

alter table public.gmp_sales_quotes enable row level security;
alter table public.gmp_sales_quote_lines enable row level security;
alter table public.gmp_cash_vouchers enable row level security;
alter table public.gmp_price_lists enable row level security;
alter table public.gmp_price_list_items enable row level security;

drop policy if exists gmp_sales_quotes_member_read on public.gmp_sales_quotes;
create policy gmp_sales_quotes_member_read on public.gmp_sales_quotes for select using (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_sales_quotes.organization_id and m.user_id=(select auth.uid()))
);
drop policy if exists gmp_sales_quotes_admin_write on public.gmp_sales_quotes;
create policy gmp_sales_quotes_admin_write on public.gmp_sales_quotes for all using (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_sales_quotes.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
) with check (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_sales_quotes.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
drop policy if exists gmp_sales_quote_lines_member_read on public.gmp_sales_quote_lines;
create policy gmp_sales_quote_lines_member_read on public.gmp_sales_quote_lines for select using (
  exists(select 1 from public.gmp_sales_quotes q join public.gmp_organization_members m on m.organization_id=q.organization_id where q.id=gmp_sales_quote_lines.quote_id and m.user_id=(select auth.uid()))
);
drop policy if exists gmp_sales_quote_lines_admin_write on public.gmp_sales_quote_lines;
create policy gmp_sales_quote_lines_admin_write on public.gmp_sales_quote_lines for all using (
  exists(select 1 from public.gmp_sales_quotes q join public.gmp_organization_members m on m.organization_id=q.organization_id where q.id=gmp_sales_quote_lines.quote_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
) with check (
  exists(select 1 from public.gmp_sales_quotes q join public.gmp_organization_members m on m.organization_id=q.organization_id where q.id=gmp_sales_quote_lines.quote_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
drop policy if exists gmp_cash_vouchers_member_read on public.gmp_cash_vouchers;
create policy gmp_cash_vouchers_member_read on public.gmp_cash_vouchers for select using (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_cash_vouchers.organization_id and m.user_id=(select auth.uid()))
);
drop policy if exists gmp_cash_vouchers_admin_write on public.gmp_cash_vouchers;
create policy gmp_cash_vouchers_admin_write on public.gmp_cash_vouchers for all using (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_cash_vouchers.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
) with check (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_cash_vouchers.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
drop policy if exists gmp_price_lists_member_read on public.gmp_price_lists;
create policy gmp_price_lists_member_read on public.gmp_price_lists for select using (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_price_lists.organization_id and m.user_id=(select auth.uid()))
);
drop policy if exists gmp_price_lists_admin_write on public.gmp_price_lists;
create policy gmp_price_lists_admin_write on public.gmp_price_lists for all using (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_price_lists.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
) with check (
  exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_price_lists.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
drop policy if exists gmp_price_list_items_member_read on public.gmp_price_list_items;
create policy gmp_price_list_items_member_read on public.gmp_price_list_items for select using (
  exists(select 1 from public.gmp_price_lists p join public.gmp_organization_members m on m.organization_id=p.organization_id where p.id=gmp_price_list_items.price_list_id and m.user_id=(select auth.uid()))
);
drop policy if exists gmp_price_list_items_admin_write on public.gmp_price_list_items;
create policy gmp_price_list_items_admin_write on public.gmp_price_list_items for all using (
  exists(select 1 from public.gmp_price_lists p join public.gmp_organization_members m on m.organization_id=p.organization_id where p.id=gmp_price_list_items.price_list_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
) with check (
  exists(select 1 from public.gmp_price_lists p join public.gmp_organization_members m on m.organization_id=p.organization_id where p.id=gmp_price_list_items.price_list_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))
);
