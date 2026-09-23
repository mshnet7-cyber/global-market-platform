-- Commercial integrity and query-plan hardening.
-- Preserve business behavior while tightening RLS evaluation, policy overlap,
-- quote conversion invariants, and documented FK indexes.

-- 1) RLS policies: evaluate auth.uid() once per statement.
drop policy if exists gmp_gold_buybacks_member_read on public.gmp_gold_buybacks;
create policy gmp_gold_buybacks_member_read
on public.gmp_gold_buybacks
for select to authenticated
using (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_gold_buybacks.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists gmp_gold_exchanges_member_read on public.gmp_gold_exchanges;
create policy gmp_gold_exchanges_member_read
on public.gmp_gold_exchanges
for select to authenticated
using (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_gold_exchanges.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists gmp_manufacturing_components_member_read on public.gmp_manufacturing_components;
create policy gmp_manufacturing_components_member_read
on public.gmp_manufacturing_components
for select to authenticated
using (
  exists (
    select 1
    from public.gmp_manufacturing_orders o
    join public.gmp_organization_members m on m.organization_id = o.organization_id
    where o.id = gmp_manufacturing_components.manufacturing_order_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists gmp_manufacturing_orders_member_read on public.gmp_manufacturing_orders;
create policy gmp_manufacturing_orders_member_read
on public.gmp_manufacturing_orders
for select to authenticated
using (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_manufacturing_orders.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists gmp_purchase_receipt_idempotency_member_read on public.gmp_purchase_receipt_idempotency;
create policy gmp_purchase_receipt_idempotency_member_read
on public.gmp_purchase_receipt_idempotency
for select to authenticated
using (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_purchase_receipt_idempotency.organization_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists gmp_repair_operation_idempotency_member_read on public.gmp_repair_operation_idempotency;
create policy gmp_repair_operation_idempotency_member_read
on public.gmp_repair_operation_idempotency
for select to authenticated
using (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_repair_operation_idempotency.organization_id
      and m.user_id = (select auth.uid())
  )
);

-- 2) Remove the SELECT overlap in gold price rules. Member-read remains the
-- canonical SELECT path; owner/admin privileges are limited to writes.
drop policy if exists gmp_gold_price_rules_admin_write on public.gmp_gold_price_rules;

create policy gmp_gold_price_rules_admin_insert
on public.gmp_gold_price_rules
for insert to authenticated
with check (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_gold_price_rules.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
  and (
    store_id is null
    or exists (
      select 1 from public.gmp_stores s
      where s.id = gmp_gold_price_rules.store_id
        and s.organization_id = gmp_gold_price_rules.organization_id
    )
  )
);

create policy gmp_gold_price_rules_admin_update
on public.gmp_gold_price_rules
for update to authenticated
using (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_gold_price_rules.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_gold_price_rules.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
  and (
    store_id is null
    or exists (
      select 1 from public.gmp_stores s
      where s.id = gmp_gold_price_rules.store_id
        and s.organization_id = gmp_gold_price_rules.organization_id
    )
  )
);

create policy gmp_gold_price_rules_admin_delete
on public.gmp_gold_price_rules
for delete to authenticated
using (
  exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id = gmp_gold_price_rules.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner','admin')
  )
);

-- 3) Quote conversion integrity: one sale can belong to at most one quote,
-- and a converted quote must always carry its resulting sale.
create unique index if not exists gmp_sales_quotes_converted_sale_unique_idx
  on public.gmp_sales_quotes(converted_sale_id)
  where converted_sale_id is not null;

alter table public.gmp_sales_quotes
  drop constraint if exists gmp_sales_quotes_conversion_state_ck;

alter table public.gmp_sales_quotes
  add constraint gmp_sales_quotes_conversion_state_ck
  check (
    (status = 'converted' and converted_sale_id is not null)
    or (status <> 'converted' and converted_sale_id is null)
  );

-- 4) Cover the FK columns identified by the live performance advisor.
create index if not exists gmp_gold_buybacks_branch_id_idx on public.gmp_gold_buybacks(branch_id);
create index if not exists gmp_gold_buybacks_created_by_idx on public.gmp_gold_buybacks(created_by);
create index if not exists gmp_gold_buybacks_customer_id_idx on public.gmp_gold_buybacks(customer_id);
create index if not exists gmp_gold_buybacks_gold_ledger_entry_id_idx on public.gmp_gold_buybacks(gold_ledger_entry_id);
create index if not exists gmp_gold_buybacks_journal_entry_id_idx on public.gmp_gold_buybacks(journal_entry_id);
create index if not exists gmp_gold_buybacks_product_id_idx on public.gmp_gold_buybacks(product_id);
create index if not exists gmp_gold_buybacks_store_id_idx on public.gmp_gold_buybacks(store_id);

create index if not exists gmp_gold_exchanges_branch_id_idx on public.gmp_gold_exchanges(branch_id);
create index if not exists gmp_gold_exchanges_created_by_idx on public.gmp_gold_exchanges(created_by);
create index if not exists gmp_gold_exchanges_customer_id_idx on public.gmp_gold_exchanges(customer_id);
create index if not exists gmp_gold_exchanges_new_product_id_idx on public.gmp_gold_exchanges(new_product_id);
create index if not exists gmp_gold_exchanges_old_product_id_idx on public.gmp_gold_exchanges(old_product_id);
create index if not exists gmp_gold_exchanges_store_id_idx on public.gmp_gold_exchanges(store_id);

create index if not exists gmp_gold_ledger_entries_branch_id_idx on public.gmp_gold_ledger_entries(branch_id);
create index if not exists gmp_gold_ledger_entries_created_by_idx on public.gmp_gold_ledger_entries(created_by);

create index if not exists gmp_gold_price_rules_created_by_idx on public.gmp_gold_price_rules(created_by);
create index if not exists gmp_gold_price_rules_organization_id_idx on public.gmp_gold_price_rules(organization_id);

create index if not exists gmp_manufacturing_components_product_id_idx on public.gmp_manufacturing_components(product_id);

create index if not exists gmp_manufacturing_orders_branch_id_idx on public.gmp_manufacturing_orders(branch_id);
create index if not exists gmp_manufacturing_orders_completed_by_idx on public.gmp_manufacturing_orders(completed_by);
create index if not exists gmp_manufacturing_orders_created_by_idx on public.gmp_manufacturing_orders(created_by);
create index if not exists gmp_manufacturing_orders_output_product_id_idx on public.gmp_manufacturing_orders(output_product_id);

create index if not exists gmp_price_list_items_product_id_idx on public.gmp_price_list_items(product_id);
create index if not exists gmp_price_lists_store_id_idx on public.gmp_price_lists(store_id);

create index if not exists gmp_purchase_receipt_idempotency_created_by_idx on public.gmp_purchase_receipt_idempotency(created_by);
create index if not exists gmp_purchase_receipt_idempotency_purchase_id_idx on public.gmp_purchase_receipt_idempotency(purchase_id);

create index if not exists gmp_repair_operation_idempotency_created_by_idx on public.gmp_repair_operation_idempotency(created_by);
create index if not exists gmp_repair_operation_idempotency_repair_id_idx on public.gmp_repair_operation_idempotency(repair_id);

create index if not exists gmp_repair_orders_store_id_idx on public.gmp_repair_orders(store_id);

create index if not exists gmp_sales_quote_lines_product_id_idx on public.gmp_sales_quote_lines(product_id);
create index if not exists gmp_sales_quotes_branch_id_idx on public.gmp_sales_quotes(branch_id);
create index if not exists gmp_sales_quotes_customer_id_idx on public.gmp_sales_quotes(customer_id);
create index if not exists gmp_sales_quotes_store_id_idx on public.gmp_sales_quotes(store_id);
