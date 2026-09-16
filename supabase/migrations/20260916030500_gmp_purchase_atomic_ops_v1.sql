-- Make merchant purchase creation atomic so a failed line insert cannot leave an orphan purchase header.
CREATE OR REPLACE FUNCTION public.gmp_create_purchase(
  p_organization_id uuid,
  p_branch_id uuid,
  p_store_id uuid,
  p_supplier_id uuid,
  p_invoice_no text,
  p_lines jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
declare
  v_actor uuid := (select auth.uid());
  v_purchase_id uuid;
  v_line jsonb;
  v_qty numeric;
  v_weight numeric;
  v_unit_cost numeric;
  v_vat numeric;
  v_making numeric;
  v_subtotal numeric := 0;
  v_vat_total numeric := 0;
  v_branch uuid;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')
  ) then raise exception 'not authorized'; end if;
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 then raise exception 'store_and_lines_required'; end if;
  select s.branch_id into v_branch from public.gmp_stores s where s.id=p_store_id and s.organization_id=p_organization_id and s.active=true;
  if not found then raise exception 'store not found'; end if;
  if p_branch_id is not null and v_branch is not null and p_branch_id<>v_branch then raise exception 'branch store mismatch'; end if;
  if p_supplier_id is not null and not exists(select 1 from public.gmp_suppliers s where s.id=p_supplier_id and s.organization_id=p_organization_id and s.active=true) then raise exception 'supplier not found'; end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_qty:=nullif(v_line->>'quantity','')::numeric;
    v_weight:=coalesce(nullif(v_line->>'weight_grams','')::numeric,0);
    v_unit_cost:=nullif(v_line->>'unit_cost','')::numeric;
    v_vat:=coalesce(nullif(v_line->>'vat_amount','')::numeric,0);
    v_making:=coalesce(nullif(v_line->>'making_charge','')::numeric,0);
    if coalesce(trim(v_line->>'raw_description'),'')='' or v_qty is null or v_qty<=0 or v_weight<0 or v_unit_cost is null or v_unit_cost<0 or v_vat<0 or v_making<0 then raise exception 'invalid_purchase_line'; end if;
    v_subtotal:=v_subtotal+(v_qty*v_unit_cost)+v_making;
    v_vat_total:=v_vat_total+v_vat;
  end loop;

  insert into public.gmp_purchases(organization_id,branch_id,store_id,supplier_id,invoice_no,status,subtotal,vat_amount,total,created_by)
  values(p_organization_id,coalesce(p_branch_id,v_branch),p_store_id,p_supplier_id,nullif(trim(p_invoice_no),''),'draft',v_subtotal,v_vat_total,v_subtotal+v_vat_total,v_actor)
  returning id into v_purchase_id;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    insert into public.gmp_purchase_lines(
      purchase_id,product_id,raw_description,sku,barcode,karat,country_of_origin,quantity,weight_grams,unit_cost,making_charge,vat_amount
    ) values(
      v_purchase_id,
      nullif(v_line->>'product_id','')::uuid,
      left(v_line->>'raw_description',500),
      nullif(left(v_line->>'sku',80),''),
      nullif(left(v_line->>'barcode',80),''),
      nullif(left(v_line->>'karat',20),''),
      nullif(left(v_line->>'country_of_origin',80),''),
      nullif(v_line->>'quantity','')::numeric,
      coalesce(nullif(v_line->>'weight_grams','')::numeric,0),
      nullif(v_line->>'unit_cost','')::numeric,
      coalesce(nullif(v_line->>'making_charge','')::numeric,0),
      coalesce(nullif(v_line->>'vat_amount','')::numeric,0)
    );
  end loop;

  return jsonb_build_object('success',true,'purchase_id',v_purchase_id,'subtotal',v_subtotal,'vat_amount',v_vat_total,'total',v_subtotal+v_vat_total);
end;
$$;

REVOKE ALL ON FUNCTION public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gmp_create_purchase(uuid,uuid,uuid,uuid,text,jsonb) TO authenticated;
