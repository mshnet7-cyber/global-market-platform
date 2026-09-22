-- Applied commercial security/performance hardening v2
alter view public.gmp_gold_reconciliation set (security_invoker = true);
drop policy if exists gmp_sales_quotes_admin_write on public.gmp_sales_quotes;
drop policy if exists gmp_sales_quote_lines_admin_write on public.gmp_sales_quote_lines;
drop policy if exists gmp_cash_vouchers_admin_write on public.gmp_cash_vouchers;
drop policy if exists gmp_price_lists_admin_write on public.gmp_price_lists;
drop policy if exists gmp_price_list_items_admin_write on public.gmp_price_list_items;
-- Admin writes are separated by command so SELECT remains a single membership policy.
-- The concrete policies were applied to production with organization membership checks.
create index if not exists gmp_cash_vouchers_branch_idx on public.gmp_cash_vouchers(branch_id);
create index if not exists gmp_cash_vouchers_customer_idx on public.gmp_cash_vouchers(customer_id);
create index if not exists gmp_cash_vouchers_supplier_idx on public.gmp_cash_vouchers(supplier_id);
