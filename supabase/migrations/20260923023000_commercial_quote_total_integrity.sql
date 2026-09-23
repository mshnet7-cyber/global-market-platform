-- Financial integrity hardening for commercial quotation totals.
-- The API may calculate totals for UX, but the database is the final authority.

create or replace function public.gmp_create_sales_quote(
  p_organization_id uuid,
  p_store_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_valid_until date,
  p_currency text,
  p_subtotal numeric,
  p_discount_amount numeric,
  p_vat_amount numeric,
  p_total numeric,
  p_notes text,
  p_lines jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  quote_row public.gmp_sales_quotes%rowtype;
  line jsonb;
  product_id uuid;
  generated_quote_no text;
  line_count integer := 0;
  calculated_subtotal numeric := 0;
  calculated_discount numeric := 0;
  calculated_vat numeric := 0;
  normalized_discount numeric := greatest(coalesce(p_discount_amount,0),0);
  normalized_vat numeric := greatest(coalesce(p_vat_amount,0),0);
  calculated_total numeric;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1
    from public.gmp_organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=(select auth.uid())
      and m.role in ('owner','admin')
  ) then
    raise exception 'organization_write_forbidden';
  end if;

  if not exists (
    select 1 from public.gmp_stores s
    where s.id=p_store_id and s.organization_id=p_organization_id
  ) then
    raise exception 'store_not_found';
  end if;

  if p_branch_id is not null then
    if not exists (
      select 1 from public.gmp_branches b
      where b.id=p_branch_id and b.organization_id=p_organization_id
    ) then
      raise exception 'branch_not_found';
    end if;
    if exists (
      select 1 from public.gmp_branches b
      where b.id=p_branch_id
        and b.store_id is not null
        and b.store_id<>p_store_id
    ) then
      raise exception 'branch_store_mismatch';
    end if;
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.gmp_customers c
    where c.id=p_customer_id and c.organization_id=p_organization_id
  ) then
    raise exception 'customer_not_found';
  end if;

  if jsonb_typeof(p_lines) <> 'array' then raise exception 'lines_required'; end if;
  if jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 100 then
    raise exception 'lines_required';
  end if;

  if p_currency is null or length(trim(p_currency))=0 then
    raise exception 'currency_required';
  end if;

  for line in select value from jsonb_array_elements(p_lines)
  loop
    if nullif(trim(line->>'product_id'),'') is not null
       and (line->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      product_id := (line->>'product_id')::uuid;
      if not exists (
        select 1 from public.gmp_products p
        where p.id=product_id
          and p.organization_id=p_organization_id
      ) then
        raise exception 'product_not_found';
      end if;
      if exists (
        select 1 from public.gmp_products p
        where p.id=product_id
          and p.store_id is not null
          and p.store_id<>p_store_id
      ) then
        raise exception 'product_store_mismatch';
      end if;
    end if;

    calculated_subtotal := calculated_subtotal
      + greatest(coalesce((line->>'quantity')::numeric,1),0)
        * greatest(coalesce((line->>'unit_price')::numeric,0),0)
      + greatest(coalesce((line->>'making_charge')::numeric,0),0);
    calculated_discount := calculated_discount
      + greatest(coalesce((line->>'discount_amount')::numeric,0),0);
    calculated_vat := calculated_vat
      + greatest(coalesce((line->>'vat_amount')::numeric,0),0);
    line_count := line_count + 1;
  end loop;

  calculated_total := greatest(calculated_subtotal - normalized_discount + normalized_vat,0);

  -- Header totals are a financial record, so never trust caller-supplied
  -- subtotal/total values when they disagree with the normalized lines.
  if round(greatest(coalesce(p_subtotal,0),0),3) <> round(calculated_subtotal,3) then
    raise exception 'quote_subtotal_mismatch';
  end if;
  if round(greatest(coalesce(p_total,0),0),3) <> round(calculated_total,3) then
    raise exception 'quote_total_mismatch';
  end if;

  generated_quote_no :=
    'QT-' ||
    to_char(clock_timestamp(),'YYYYMMDDHH24MISS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.gmp_sales_quotes(
    organization_id,store_id,branch_id,customer_id,quote_no,status,valid_until,
    currency,subtotal,discount_amount,vat_amount,total,notes,created_by
  )
  values (
    p_organization_id,p_store_id,p_branch_id,p_customer_id,generated_quote_no,'draft',
    p_valid_until,trim(p_currency),round(calculated_subtotal,3),round(normalized_discount,3),
    round(normalized_vat,3),round(calculated_total,3),nullif(trim(p_notes),''),(select auth.uid())
  )
  returning * into quote_row;

  insert into public.gmp_sales_quote_lines(
    quote_id,product_id,description,quantity,weight_grams,unit_price,
    making_charge,discount_amount,vat_amount,line_total
  )
  select
    quote_row.id,
    case
      when nullif(trim(x->>'product_id'),'') is not null
       and (x->>'product_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (x->>'product_id')::uuid else null end,
    left(coalesce(x->>'description',''),300),
    greatest(coalesce((x->>'quantity')::numeric,1),0),
    greatest(coalesce((x->>'weight_grams')::numeric,0),0),
    greatest(coalesce((x->>'unit_price')::numeric,0),0),
    greatest(coalesce((x->>'making_charge')::numeric,0),0),
    greatest(coalesce((x->>'discount_amount')::numeric,0),0),
    greatest(coalesce((x->>'vat_amount')::numeric,0),0),
    greatest(
      greatest(coalesce((x->>'quantity')::numeric,1),0)
      * greatest(coalesce((x->>'unit_price')::numeric,0),0)
      + greatest(coalesce((x->>'making_charge')::numeric,0),0)
      - greatest(coalesce((x->>'discount_amount')::numeric,0),0)
      + greatest(coalesce((x->>'vat_amount')::numeric,0),0),
      0
    )
  from jsonb_array_elements(p_lines) x;

  return jsonb_build_object(
    'quote', to_jsonb(quote_row),
    'quote_id', quote_row.id,
    'quote_no', quote_row.quote_no,
    'line_count', line_count
  );
end;
$function$;

revoke all on function public.gmp_create_sales_quote(uuid,uuid,uuid,uuid,date,text,numeric,numeric,numeric,numeric,text,jsonb) from public,anon,authenticated;
grant execute on function public.gmp_create_sales_quote(uuid,uuid,uuid,uuid,date,text,numeric,numeric,numeric,numeric,text,jsonb) to authenticated;
