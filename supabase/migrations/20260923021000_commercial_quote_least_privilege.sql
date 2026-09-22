-- Commercial quote RPC least-privilege hardening.
-- These two functions already execute only owner/admin paths and do not need
-- SECURITY DEFINER privileges themselves. The sale-posting RPC they call
-- remains SECURITY DEFINER as the transactional write boundary.

create or replace function public.gmp_set_sales_quote_status(
  p_organization_id uuid,
  p_quote_id uuid,
  p_status text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  q public.gmp_sales_quotes%rowtype;
  allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=auth.uid()
      and m.role in ('owner','admin')
  ) then raise exception 'organization_write_forbidden'; end if;

  if p_status not in ('draft','sent','accepted','rejected','expired','converted','cancelled') then
    raise exception 'invalid_quote_status';
  end if;

  select * into q from public.gmp_sales_quotes
  where id=p_quote_id and organization_id=p_organization_id
  for update;

  if not found then raise exception 'quote_not_found'; end if;
  if q.status=p_status then return jsonb_build_object('quote_id',q.id,'status',q.status); end if;

  allowed := (q.status='draft' and p_status in ('sent','cancelled'))
          or (q.status='sent' and p_status in ('accepted','rejected','expired','cancelled'))
          or (q.status='accepted' and p_status='cancelled');

  if not allowed then raise exception 'invalid_quote_transition'; end if;

  update public.gmp_sales_quotes
  set status=p_status, updated_at=now()
  where id=q.id;

  return jsonb_build_object('quote_id',q.id,'status',p_status);
end;
$function$;

create or replace function public.gmp_convert_sales_quote(
  p_organization_id uuid,
  p_quote_id uuid,
  p_payment_method text,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  q public.gmp_sales_quotes%rowtype;
  sale jsonb;
  lines jsonb;
  sale_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=auth.uid()
      and m.role in ('owner','admin')
  ) then
    raise exception 'organization_write_forbidden';
  end if;

  if p_payment_method not in ('cash','bank','card','wallet','other') then
    raise exception 'invalid_payment_method';
  end if;

  select * into q from public.gmp_sales_quotes
  where id=p_quote_id and organization_id=p_organization_id
  for update;

  if not found then raise exception 'quote_not_found'; end if;

  if q.status='converted' then
    if q.converted_sale_id is null then raise exception 'quote_conversion_state_invalid'; end if;
    return jsonb_build_object('quote_id',q.id,'status','converted','sale_id',q.converted_sale_id);
  end if;

  if q.status <> 'accepted' then raise exception 'quote_must_be_accepted'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id',l.product_id,
    'quantity',l.quantity,
    'weight_grams',l.weight_grams,
    'unit_price',l.unit_price,
    'making_charge',l.making_charge,
    'discount_amount',l.discount_amount,
    'vat_amount',l.vat_amount
  ) order by l.id),'[]'::jsonb)
  into lines
  from public.gmp_sales_quote_lines l
  where l.quote_id=q.id;

  if jsonb_array_length(lines)=0 then raise exception 'quote_lines_required'; end if;

  sale := public.gmp_create_and_post_sale(
    q.organization_id,q.branch_id,q.store_id,q.customer_id,p_payment_method,
    coalesce(p_notes,q.notes),lines
  );

  sale_id := (sale->>'sale_id')::uuid;
  if sale_id is null then raise exception 'sale_conversion_missing_id'; end if;

  update public.gmp_sales_quotes
  set status='converted', converted_sale_id=sale_id, updated_at=now()
  where id=q.id;

  return jsonb_build_object('quote_id',q.id,'status','converted','sale',sale);
end;
$function$;

revoke all on function public.gmp_set_sales_quote_status(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.gmp_set_sales_quote_status(uuid,uuid,text) to authenticated;

revoke all on function public.gmp_convert_sales_quote(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.gmp_convert_sales_quote(uuid,uuid,text,text) to authenticated;

create index if not exists gmp_gold_price_rules_store_id_idx
  on public.gmp_gold_price_rules(store_id);
