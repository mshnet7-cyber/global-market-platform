-- RLS for merchant commercial completeness tables
alter table public.gmp_sales_quotes enable row level security;
alter table public.gmp_sales_quote_lines enable row level security;
alter table public.gmp_cash_vouchers enable row level security;
alter table public.gmp_price_lists enable row level security;
alter table public.gmp_price_list_items enable row level security;

drop policy if exists gmp_sales_quotes_member_read on public.gmp_sales_quotes;
create policy gmp_sales_quotes_member_read on public.gmp_sales_quotes for select using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_sales_quotes.organization_id and m.user_id=(select auth.uid())));
drop policy if exists gmp_sales_quotes_admin_write on public.gmp_sales_quotes;
create policy gmp_sales_quotes_admin_write on public.gmp_sales_quotes for all using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_sales_quotes.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_sales_quotes.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_sales_quote_lines_member_read on public.gmp_sales_quote_lines;
create policy gmp_sales_quote_lines_member_read on public.gmp_sales_quote_lines for select using (exists(select 1 from public.gmp_sales_quotes q join public.gmp_organization_members m on m.organization_id=q.organization_id where q.id=gmp_sales_quote_lines.quote_id and m.user_id=(select auth.uid())));
drop policy if exists gmp_sales_quote_lines_admin_write on public.gmp_sales_quote_lines;
create policy gmp_sales_quote_lines_admin_write on public.gmp_sales_quote_lines for all using (exists(select 1 from public.gmp_sales_quotes q join public.gmp_organization_members m on m.organization_id=q.organization_id where q.id=gmp_sales_quote_lines.quote_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.gmp_sales_quotes q join public.gmp_organization_members m on m.organization_id=q.organization_id where q.id=gmp_sales_quote_lines.quote_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_cash_vouchers_member_read on public.gmp_cash_vouchers;
create policy gmp_cash_vouchers_member_read on public.gmp_cash_vouchers for select using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_cash_vouchers.organization_id and m.user_id=(select auth.uid())));
drop policy if exists gmp_cash_vouchers_admin_write on public.gmp_cash_vouchers;
create policy gmp_cash_vouchers_admin_write on public.gmp_cash_vouchers for all using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_cash_vouchers.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_cash_vouchers.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_price_lists_member_read on public.gmp_price_lists;
create policy gmp_price_lists_member_read on public.gmp_price_lists for select using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_price_lists.organization_id and m.user_id=(select auth.uid())));
drop policy if exists gmp_price_lists_admin_write on public.gmp_price_lists;
create policy gmp_price_lists_admin_write on public.gmp_price_lists for all using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_price_lists.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_price_lists.organization_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));

drop policy if exists gmp_price_list_items_member_read on public.gmp_price_list_items;
create policy gmp_price_list_items_member_read on public.gmp_price_list_items for select using (exists(select 1 from public.gmp_price_lists p join public.gmp_organization_members m on m.organization_id=p.organization_id where p.id=gmp_price_list_items.price_list_id and m.user_id=(select auth.uid())));
drop policy if exists gmp_price_list_items_admin_write on public.gmp_price_list_items;
create policy gmp_price_list_items_admin_write on public.gmp_price_list_items for all using (exists(select 1 from public.gmp_price_lists p join public.gmp_organization_members m on m.organization_id=p.organization_id where p.id=gmp_price_list_items.price_list_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin'))) with check (exists(select 1 from public.gmp_price_lists p join public.gmp_organization_members m on m.organization_id=p.organization_id where p.id=gmp_price_list_items.price_list_id and m.user_id=(select auth.uid()) and m.role in ('owner','admin')));
