-- Store-issued internal labels are distinct from global GS1 identifiers.
create sequence if not exists public.gmp_internal_product_barcode_seq as bigint start with 1 increment by 1 no cycle;

create table if not exists public.gmp_product_barcode_registry (
  store_id uuid not null references public.gmp_stores(id) on delete restrict,
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  barcode text not null,
  created_at timestamptz not null default now(),
  primary key (store_id,barcode)
);
alter table public.gmp_product_barcode_registry enable row level security;
revoke all on table public.gmp_product_barcode_registry from public,anon,authenticated;
revoke all on sequence public.gmp_internal_product_barcode_seq from public,anon,authenticated;

create or replace function public.gmp_create_inventory_product_with_barcode(
  p_organization_id uuid,
  p_store_id uuid,
  p_name text,
  p_sku text,
  p_barcode text,
  p_category text,
  p_karat text,
  p_price numeric,
  p_cost_price numeric,
  p_making_charge numeric,
  p_initial_quantity numeric,
  p_initial_weight numeric
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_barcode text := nullif(trim(coalesce(p_barcode,'')),'');
  v_generated boolean := false;
  v_result jsonb;
  v_attempt integer := 0;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')
  ) then raise exception 'not authorized'; end if;
  if not exists (
    select 1 from public.gmp_stores s
    where s.id=p_store_id and s.organization_id=p_organization_id and s.active=true
  ) then raise exception 'store not found'; end if;

  if v_barcode is null then
    v_generated := true;
    loop
      v_attempt := v_attempt + 1;
      if v_attempt > 20 then raise exception 'barcode_generation_failed'; end if;
      v_barcode := 'AG' || lpad(nextval('public.gmp_internal_product_barcode_seq')::text,12,'0');
      exit when not exists (
        select 1 from public.gmp_product_barcode_registry b
        where b.store_id=p_store_id and b.barcode=v_barcode
      ) and not exists (
        select 1 from public.gmp_products p
        where p.store_id=p_store_id and p.barcode=v_barcode
      );
    end loop;
  else
    if length(v_barcode)>80 then raise exception 'barcode_too_long'; end if;
    if exists (
      select 1 from public.gmp_products p
      where p.store_id=p_store_id and p.barcode=v_barcode
    ) then raise exception 'barcode_already_in_use'; end if;
  end if;

  insert into public.gmp_product_barcode_registry(store_id,organization_id,barcode)
  values(p_store_id,p_organization_id,v_barcode);

  v_result := public.gmp_create_inventory_product(
    p_organization_id,p_store_id,p_name,p_sku,v_barcode,p_category,p_karat,
    p_price,p_cost_price,p_making_charge,p_initial_quantity,p_initial_weight
  );
  if v_result is null or jsonb_typeof(v_result)<>'object' then raise exception 'product_creation_failed'; end if;
  return v_result || jsonb_build_object('barcode',v_barcode,'barcode_generated',v_generated);
end;
$$;

revoke all on function public.gmp_create_inventory_product_with_barcode(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric) from public,anon;
grant execute on function public.gmp_create_inventory_product_with_barcode(uuid,uuid,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric) to authenticated;
