create or replace function public.gmp_enforce_repair_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  if old.status = 'received' and new.status in ('in_repair','cancelled') then
    return new;
  end if;
  if old.status = 'in_repair' and new.status in ('ready','cancelled') then
    return new;
  end if;
  if old.status = 'ready' and new.status in ('delivered','in_repair','cancelled') then
    return new;
  end if;

  raise exception 'invalid_repair_status_transition: % -> %', old.status, new.status using errcode = 'P0001';
end;
$$;

drop trigger if exists gmp_repair_status_transition_guard on public.gmp_repair_orders;
create trigger gmp_repair_status_transition_guard
before update of status on public.gmp_repair_orders
for each row execute function public.gmp_enforce_repair_status_transition();

comment on function public.gmp_enforce_repair_status_transition() is 'Enforces the allowed repair-order status state machine at the database boundary.';
