-- Repair custody is tracked separately from shop-owned inventory and the gold valuation ledger.
create table if not exists public.gmp_repair_intake_requests (
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  client_ref text not null check (length(trim(client_ref)) between 16 and 128),
  repair_id uuid references public.gmp_repair_orders(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (organization_id, client_ref)
);
alter table public.gmp_repair_intake_requests enable row level security;
revoke all on table public.gmp_repair_intake_requests from public, anon, authenticated;

create table if not exists public.gmp_repair_custody_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.gmp_organizations(id) on delete cascade,
  branch_id uuid references public.gmp_branches(id) on delete restrict,
  store_id uuid not null references public.gmp_stores(id) on delete restrict,
  repair_id uuid not null references public.gmp_repair_orders(id) on delete restrict,
  movement_type text not null check (movement_type in ('received','sent_to_workshop','returned_from_workshop','delivered')),
  source_location text not null check (source_location in ('customer','shop','workshop')),
  destination_location text not null check (destination_location in ('customer','shop','workshop')),
  counterparty text,
  metal text,
  karat numeric(6,3) not null check (karat > 0 and karat <= 24),
  weight_grams numeric(20,6) not null check (weight_grams > 0),
  idempotency_key text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gmp_repair_custody_idempotency_uniq unique (organization_id,idempotency_key),
  constraint gmp_repair_custody_location_check check (source_location <> destination_location)
);
create index if not exists gmp_repair_custody_repair_created_idx
  on public.gmp_repair_custody_ledger(organization_id,repair_id,created_at);
alter table public.gmp_repair_custody_ledger enable row level security;
drop policy if exists gmp_repair_custody_member_read on public.gmp_repair_custody_ledger;
create policy gmp_repair_custody_member_read on public.gmp_repair_custody_ledger
for select to authenticated using (
  exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=gmp_repair_custody_ledger.organization_id
      and m.user_id=(select auth.uid())
  )
);
revoke all on table public.gmp_repair_custody_ledger from public, anon, authenticated;
grant select on table public.gmp_repair_custody_ledger to authenticated;

create or replace view public.gmp_repair_custody_balances with (security_invoker=true) as
with position_events as (
  select organization_id,store_id,repair_id,source_location as location,-weight_grams as delta
  from public.gmp_repair_custody_ledger
  union all
  select organization_id,store_id,repair_id,destination_location as location,weight_grams as delta
  from public.gmp_repair_custody_ledger
)
select organization_id,store_id,repair_id,location,sum(delta) as weight_grams
from position_events
group by organization_id,store_id,repair_id,location
having sum(delta) <> 0;
revoke all on public.gmp_repair_custody_balances from public, anon;
grant select on public.gmp_repair_custody_balances to authenticated;

create or replace function public.gmp_create_repair_intake(
  p_organization_id uuid,
  p_client_ref text,
  p_store_id uuid,
  p_customer_id uuid,
  p_item_description text,
  p_metal text,
  p_karat text,
  p_weight_received_grams numeric,
  p_repair_type text,
  p_damage_description text,
  p_amount numeric,
  p_notes text,
  p_before_photo_document_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_branch_id uuid;
  v_photo_path text;
  v_repair public.gmp_repair_orders%rowtype;
  v_existing uuid;
  v_existing_actor uuid;
  v_karat numeric;
  v_reserved boolean := false;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if coalesce(trim(p_client_ref),'') = '' then raise exception 'client_ref_required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')
  ) then raise exception 'not_authorized'; end if;
  if coalesce(trim(p_item_description),'') = '' or p_weight_received_grams is null or p_weight_received_grams <= 0 then
    raise exception 'repair_item_and_weight_required';
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'invalid_repair_amount'; end if;
  if length(trim(p_item_description))>500 or length(coalesce(p_metal,''))>30 or length(trim(coalesce(p_karat,'')))>20
     or length(coalesce(p_repair_type,''))>100 or length(coalesce(p_damage_description,''))>1200 or length(coalesce(p_notes,''))>1500 then
    raise exception 'repair_field_too_long';
  end if;
  if lower(trim(coalesce(p_metal,''))) not in ('gold','ذهب') then raise exception 'repair_metal_unsupported'; end if;
  v_karat := nullif((regexp_match(trim(coalesce(p_karat,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric;
  if v_karat is null or v_karat <= 0 or v_karat > 24 then raise exception 'invalid_repair_karat'; end if;

  select s.branch_id into v_branch_id
  from public.gmp_stores s
  where s.id=p_store_id and s.organization_id=p_organization_id;
  if not found then raise exception 'repair_store_scope_invalid'; end if;
  if not exists (
    select 1 from public.gmp_customers c
    where c.id=p_customer_id and c.organization_id=p_organization_id
      and (c.branch_id is null or c.branch_id=v_branch_id)
  ) then raise exception 'repair_customer_scope_invalid'; end if;
  select d.storage_path into v_photo_path
  from public.gmp_documents d
  where d.id=p_before_photo_document_id and d.organization_id=p_organization_id
    and d.document_type='repair_photo' and (d.branch_id is null or d.branch_id=v_branch_id);
  if v_photo_path is null then raise exception 'repair_photo_not_found'; end if;

  insert into public.gmp_repair_intake_requests(organization_id,client_ref,created_by)
  values(p_organization_id,trim(p_client_ref),v_actor)
  on conflict (organization_id,client_ref) do nothing;
  v_reserved := found;
  select repair_id,created_by into v_existing,v_existing_actor
  from public.gmp_repair_intake_requests
  where organization_id=p_organization_id and client_ref=trim(p_client_ref)
  for update;
  if v_existing_actor is distinct from v_actor then raise exception 'repair_idempotency_conflict'; end if;
  if v_existing is not null then
    return jsonb_build_object('success',true,'idempotent',true,'repair_id',v_existing);
  end if;
  if not v_reserved then raise exception 'repair_idempotency_incomplete'; end if;

  insert into public.gmp_repair_orders(
    organization_id,store_id,branch_id,customer_id,item_description,metal,karat,
    weight_received_grams,weight_delivered_grams,damage_description,repair_type,
    status,amount,before_photo_path,notes,created_by
  ) values (
    p_organization_id,p_store_id,v_branch_id,p_customer_id,trim(p_item_description),
    nullif(trim(coalesce(p_metal,'')),''),trim(p_karat),
    p_weight_received_grams,null,nullif(trim(coalesce(p_damage_description,'')),''),
    nullif(trim(coalesce(p_repair_type,'')),''),'received',p_amount,v_photo_path,
    nullif(trim(coalesce(p_notes,'')),''),v_actor
  ) returning * into v_repair;

  insert into public.gmp_repair_custody_ledger(
    organization_id,branch_id,store_id,repair_id,movement_type,source_location,destination_location,
    counterparty,metal,karat,weight_grams,idempotency_key,created_by
  ) values (
    p_organization_id,v_branch_id,p_store_id,v_repair.id,'received','customer','shop',
    null,v_repair.metal,v_karat,p_weight_received_grams,'receive:'||trim(p_client_ref),v_actor
  );
  update public.gmp_repair_intake_requests
  set repair_id=v_repair.id
  where organization_id=p_organization_id and client_ref=trim(p_client_ref);
  return jsonb_build_object('success',true,'idempotent',false,'repair_id',v_repair.id,'repair_no',v_repair.repair_no,'status','received');
end;
$$;

create or replace function public.gmp_send_repair_to_workshop(
  p_organization_id uuid,
  p_repair_id uuid,
  p_store_id uuid,
  p_client_ref text,
  p_workshop_name text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_repair public.gmp_repair_orders%rowtype;
  v_karat numeric;
  v_existing public.gmp_repair_custody_ledger%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if coalesce(trim(p_client_ref),'')='' or length(trim(p_client_ref))>128 then raise exception 'client_ref_required'; end if;
  if not exists (select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not_authorized'; end if;
  if coalesce(trim(p_workshop_name),'')='' or length(trim(p_workshop_name))>160 then raise exception 'repair_workshop_required'; end if;
  select * into v_repair from public.gmp_repair_orders where id=p_repair_id and organization_id=p_organization_id for update;
  if not found then raise exception 'repair_not_found'; end if;
  select * into v_existing from public.gmp_repair_custody_ledger
  where organization_id=p_organization_id and idempotency_key='send:'||trim(coalesce(p_client_ref,''));
  if found then
    if v_existing.repair_id<>p_repair_id or v_existing.movement_type<>'sent_to_workshop' or v_existing.created_by is distinct from v_actor then raise exception 'repair_idempotency_conflict'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'repair_id',p_repair_id,'status','in_repair');
  end if;
  if v_repair.status<>'received' then raise exception 'invalid_repair_status'; end if;
  if v_repair.store_id is null or v_repair.store_id<>p_store_id then raise exception 'repair_store_scope_invalid'; end if;
  v_karat:=nullif((regexp_match(trim(coalesce(v_repair.karat,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric;
  if v_karat is null or v_karat<=0 or v_karat>24 then raise exception 'invalid_repair_karat'; end if;
  update public.gmp_repair_orders set status='in_repair',updated_at=now() where id=p_repair_id;
  insert into public.gmp_repair_custody_ledger(
    organization_id,branch_id,store_id,repair_id,movement_type,source_location,destination_location,
    counterparty,metal,karat,weight_grams,idempotency_key,created_by
  ) values (
    p_organization_id,v_repair.branch_id,p_store_id,p_repair_id,'sent_to_workshop','shop','workshop',
    nullif(trim(coalesce(p_workshop_name,'')),''),v_repair.metal,v_karat,v_repair.weight_received_grams,
    'send:'||trim(p_client_ref),v_actor
  );
  return jsonb_build_object('success',true,'idempotent',false,'repair_id',p_repair_id,'status','in_repair');
end;
$$;

create or replace function public.gmp_mark_repair_ready(
  p_organization_id uuid,
  p_repair_id uuid,
  p_store_id uuid,
  p_weight_delivered_grams numeric,
  p_amount numeric,
  p_after_photo_document_id uuid,
  p_client_ref text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_repair public.gmp_repair_orders%rowtype;
  v_branch_id uuid;
  v_photo_path text;
  v_karat numeric;
  v_workshop text;
  v_existing public.gmp_repair_custody_ledger%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if coalesce(trim(p_client_ref),'')='' or length(trim(p_client_ref))>128 then raise exception 'client_ref_required'; end if;
  if not exists (select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not_authorized'; end if;
  select * into v_repair from public.gmp_repair_orders where id=p_repair_id and organization_id=p_organization_id for update;
  if not found then raise exception 'repair_not_found'; end if;
  select * into v_existing from public.gmp_repair_custody_ledger
  where organization_id=p_organization_id and idempotency_key='ready:'||trim(coalesce(p_client_ref,''));
  if found then
    if v_existing.repair_id<>p_repair_id or v_existing.movement_type<>'returned_from_workshop' or v_existing.created_by is distinct from v_actor then raise exception 'repair_idempotency_conflict'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'repair_id',p_repair_id,'status','ready');
  end if;
  if v_repair.status<>'in_repair' then raise exception 'invalid_repair_status'; end if;
  if p_weight_delivered_grams is null or p_weight_delivered_grams<=0 then raise exception 'repair_delivery_weight_required'; end if;
  if p_amount is null or p_amount<0 then raise exception 'invalid_repair_amount'; end if;
  select s.branch_id into v_branch_id from public.gmp_stores s
  where s.id=p_store_id and s.organization_id=p_organization_id and s.id=v_repair.store_id;
  if not found then raise exception 'repair_store_scope_invalid'; end if;
  select d.storage_path into v_photo_path from public.gmp_documents d
  where d.id=p_after_photo_document_id and d.organization_id=p_organization_id
    and d.document_type='repair_photo' and (d.branch_id is null or d.branch_id=v_branch_id);
  if v_photo_path is null then raise exception 'repair_photo_not_found'; end if;
  select c.counterparty into v_workshop from public.gmp_repair_custody_ledger c
  where c.organization_id=p_organization_id and c.repair_id=p_repair_id and c.movement_type='sent_to_workshop'
  order by c.created_at desc limit 1;
  if not found then raise exception 'repair_workshop_dispatch_missing'; end if;
  v_karat:=nullif((regexp_match(trim(coalesce(v_repair.karat,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric;
  if v_karat is null or v_karat<=0 or v_karat>24 then raise exception 'invalid_repair_karat'; end if;
  update public.gmp_repair_orders
  set weight_delivered_grams=p_weight_delivered_grams,amount=p_amount,after_photo_path=v_photo_path,
      status='ready',ready_at=now(),updated_at=now()
  where id=p_repair_id and organization_id=p_organization_id;
  insert into public.gmp_repair_custody_ledger(
    organization_id,branch_id,store_id,repair_id,movement_type,source_location,destination_location,
    counterparty,metal,karat,weight_grams,idempotency_key,created_by
  ) values (
    p_organization_id,v_repair.branch_id,p_store_id,p_repair_id,'returned_from_workshop','workshop','shop',
    v_workshop,v_repair.metal,v_karat,p_weight_delivered_grams,'ready:'||trim(p_client_ref),v_actor
  );
  return jsonb_build_object('success',true,'idempotent',false,'repair_id',p_repair_id,'status','ready');
end;
$$;

create or replace function public.gmp_deliver_repair(
  p_organization_id uuid,
  p_repair_id uuid,
  p_store_id uuid,
  p_payment_method text,
  p_client_ref text
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_repair public.gmp_repair_orders%rowtype;
  v_existing public.gmp_repair_custody_ledger%rowtype;
  v_payment uuid;
  v_sales uuid;
  v_journal uuid;
  v_karat numeric;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if coalesce(trim(p_client_ref),'')='' or length(trim(p_client_ref))>128 then raise exception 'client_ref_required'; end if;
  if not exists (select 1 from public.gmp_organization_members m where m.organization_id=p_organization_id and m.user_id=v_actor and m.role in ('owner','admin')) then raise exception 'not_authorized'; end if;
  select * into v_repair from public.gmp_repair_orders where id=p_repair_id and organization_id=p_organization_id for update;
  if not found then raise exception 'repair_not_found'; end if;
  select * into v_existing from public.gmp_repair_custody_ledger
  where organization_id=p_organization_id and idempotency_key='deliver:'||trim(coalesce(p_client_ref,''));
  if found then
    if v_existing.repair_id<>p_repair_id or v_existing.movement_type<>'delivered' or v_existing.created_by is distinct from v_actor then raise exception 'repair_idempotency_conflict'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'repair_id',p_repair_id,'status','delivered');
  end if;
  if v_repair.status<>'ready' then raise exception 'invalid_repair_status'; end if;
  if v_repair.store_id is null or v_repair.store_id<>p_store_id then raise exception 'repair_store_scope_invalid'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','bank','card','wallet','other') then raise exception 'invalid_payment_method'; end if;
  if not exists (select 1 from public.gmp_repair_custody_ledger c where c.organization_id=p_organization_id and c.repair_id=p_repair_id and c.movement_type='returned_from_workshop') then raise exception 'repair_workshop_return_missing'; end if;
  v_karat:=nullif((regexp_match(trim(coalesce(v_repair.karat,'')),'([0-9]+(?:[.][0-9]+)?)'))[1],'')::numeric;
  if v_karat is null or v_karat<=0 or v_karat>24 then raise exception 'invalid_repair_karat'; end if;

  if coalesce(v_repair.amount,0)>0 then
    select a.id into v_payment from public.gmp_accounts a
    where a.organization_id=p_organization_id and a.system_key=case p_payment_method when 'cash' then 'cash' when 'bank' then 'bank' when 'card' then 'card' when 'wallet' then 'wallet' else 'other' end and a.active limit 1;
    select a.id into v_sales from public.gmp_accounts a
    where a.organization_id=p_organization_id and a.system_key='sales' and a.active limit 1;
    if v_payment is null or v_sales is null then raise exception 'repair_accounts_missing'; end if;
    insert into public.gmp_journal_entries(organization_id,branch_id,reference_type,reference_id,description,entry_date,status,created_by)
    values(p_organization_id,v_repair.branch_id,'repair',p_repair_id,'إيراد إصلاح وتسليم',current_date,'posted',v_actor) returning id into v_journal;
    insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo)
    values(v_journal,v_payment,coalesce(v_repair.amount,0),0,'تحصيل إصلاح');
    insert into public.gmp_journal_lines(journal_entry_id,account_id,debit,credit,memo)
    values(v_journal,v_sales,0,coalesce(v_repair.amount,0),'إيراد إصلاح');
  end if;

  update public.gmp_repair_orders
  set status='delivered',delivered_at=now(),delivered_by=v_actor,updated_at=now()
  where id=p_repair_id and organization_id=p_organization_id;
  insert into public.gmp_repair_custody_ledger(
    organization_id,branch_id,store_id,repair_id,movement_type,source_location,destination_location,
    counterparty,metal,karat,weight_grams,idempotency_key,created_by
  ) values (
    p_organization_id,v_repair.branch_id,p_store_id,p_repair_id,'delivered','shop','customer',
    null,v_repair.metal,v_karat,coalesce(v_repair.weight_delivered_grams,v_repair.weight_received_grams),
    'deliver:'||trim(p_client_ref),v_actor
  );
  return jsonb_build_object('success',true,'idempotent',false,'repair_id',p_repair_id,'status','delivered','journal_entry_id',v_journal);
end;
$$;

revoke all on function public.gmp_create_repair_intake(uuid,text,uuid,uuid,text,text,text,numeric,text,text,numeric,text,uuid) from public,anon;
grant execute on function public.gmp_create_repair_intake(uuid,text,uuid,uuid,text,text,text,numeric,text,text,numeric,text,uuid) to authenticated;
revoke all on function public.gmp_send_repair_to_workshop(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.gmp_send_repair_to_workshop(uuid,uuid,uuid,text,text) to authenticated;
revoke all on function public.gmp_mark_repair_ready(uuid,uuid,uuid,numeric,numeric,uuid,text) from public,anon;
grant execute on function public.gmp_mark_repair_ready(uuid,uuid,uuid,numeric,numeric,uuid,text) to authenticated;
revoke all on function public.gmp_deliver_repair(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.gmp_deliver_repair(uuid,uuid,uuid,text,text) to authenticated;
