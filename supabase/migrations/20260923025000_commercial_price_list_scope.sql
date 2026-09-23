-- Enforce tenant/store scope for commercial price lists and price-list items at the database boundary.
create or replace function public.gmp_validate_price_list_scope()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  list_org uuid;
  list_store uuid;
  product_org uuid;
  product_store uuid;
begin
  if tg_table_name='gmp_price_lists' then
    if new.store_id is not null then
      select s.organization_id into list_org
      from public.gmp_stores s
      where s.id=new.store_id;
      if list_org is null or list_org<>new.organization_id then
        raise exception 'store_organization_mismatch';
      end if;
    end if;
    return new;
  end if;

  select p.organization_id,p.store_id into list_org,list_store
  from public.gmp_price_lists p
  where p.id=new.price_list_id;

  if list_org is null then
    raise exception 'price_list_not_found';
  end if;

  select p.organization_id,p.store_id into product_org,product_store
  from public.gmp_products p
  where p.id=new.product_id;

  if product_org is null or product_org<>list_org then
    raise exception 'product_organization_mismatch';
  end if;

  if list_store is not null and product_store is not null and list_store<>product_store then
    raise exception 'product_store_mismatch';
  end if;

  return new;
end;
$function$;

drop trigger if exists gmp_price_lists_scope_trg on public.gmp_price_lists;
create trigger gmp_price_lists_scope_trg
before insert or update on public.gmp_price_lists
for each row execute function public.gmp_validate_price_list_scope();

drop trigger if exists gmp_price_list_items_scope_trg on public.gmp_price_list_items;
create trigger gmp_price_list_items_scope_trg
before insert or update on public.gmp_price_list_items
for each row execute function public.gmp_validate_price_list_scope();

revoke all on function public.gmp_validate_price_list_scope() from public,anon,authenticated;