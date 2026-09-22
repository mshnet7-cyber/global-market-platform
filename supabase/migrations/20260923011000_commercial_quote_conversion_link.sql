alter table public.gmp_sales_quotes add column if not exists converted_sale_id uuid references public.gmp_sales(id) on delete set null;
create index if not exists gmp_sales_quotes_converted_sale_idx on public.gmp_sales_quotes(converted_sale_id);

create or replace function public.gmp_convert_sales_quote(
  p_organization_id uuid,
  p_quote_id uuid,
  p_payment_method text,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.gmp_sales_quotes%rowtype;
  sale jsonb;
  lines jsonb;
  sale_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.role in ('owner','admin')) then raise exception 'organization_write_forbidden'; end if;
  if p_payment_method not in ('cash','bank','card','wallet','other') then raise exception 'invalid_payment_method'; end if;
  select * into q from public.gmp_sales_quotes where id=p_quote_id and organization_id=p_organization_id for update;
  if not found then raise exception 'quote_not_found'; end if;
  if q.status='converted' then return jsonb_build_object('quote_id',q.id,'status','converted','sale_id',q.converted_sale_id); end if;
  if q.status <> 'accepted' then raise exception 'quote_must_be_accepted'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('product_id',l.product_id,'quantity',l.quantity,'weight_grams',l.weight_grams,'unit_price',l.unit_price,'making_charge',l.making_charge,'discount_amount',l.discount_amount,'vat_amount',l.vat_amount) order by l.id),'[]'::jsonb) into lines from public.gmp_sales_quote_lines l where l.quote_id=q.id;
  if jsonb_array_length(lines)=0 then raise exception 'quote_lines_required'; end if;
  sale := public.gmp_create_and_post_sale(q.organization_id,q.branch_id,q.store_id,q.customer_id,p_payment_method,coalesce(p_notes,q.notes),lines);
  sale_id := (sale->>'sale_id')::uuid;
  update public.gmp_sales_quotes set status='converted', converted_sale_id=sale_id, updated_at=now() where id=q.id;
  return jsonb_build_object('quote_id',q.id,'status','converted','sale',sale);
end;
$$;
revoke all on function public.gmp_convert_sales_quote(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.gmp_convert_sales_quote(uuid,uuid,text,text) to authenticated;
