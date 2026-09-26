-- Convert an approved supplier invoice into exactly one draft purchase atomically.
-- OCR values are passed through the normal purchase validation and still require human review.
alter table public.gmp_purchases
  add column if not exists source_document_id uuid references public.gmp_documents(id) on delete set null;

create unique index if not exists gmp_purchases_organization_source_document_uidx
  on public.gmp_purchases(organization_id,source_document_id)
  where source_document_id is not null;

create or replace function public.gmp_create_purchase_from_document(
  p_organization_id uuid,
  p_branch_id uuid,
  p_store_id uuid,
  p_supplier_id uuid,
  p_invoice_no text,
  p_lines jsonb,
  p_source_document_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_approved_document_id uuid;
  v_existing_purchase_id uuid;
  v_result jsonb;
  v_purchase_id uuid;
begin
  if v_actor is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.gmp_organization_members m
    where m.organization_id=p_organization_id
      and m.user_id=v_actor
      and m.role in ('owner','admin')
  ) then raise exception 'not authorized'; end if;

  select d.id into v_approved_document_id
  from public.gmp_documents d
  where d.id=p_source_document_id
    and d.organization_id=p_organization_id
    and d.document_type='supplier_invoice'
    and d.review_status='approved'
  for update;
  if not found then raise exception 'approved_supplier_invoice_required'; end if;

  select p.id into v_existing_purchase_id
  from public.gmp_purchases p
  where p.organization_id=p_organization_id
    and p.source_document_id=p_source_document_id
  for update;
  if found then
    return jsonb_build_object('success',true,'purchase_id',v_existing_purchase_id,'already_linked',true);
  end if;

  v_result := public.gmp_create_purchase(
    p_organization_id,p_branch_id,p_store_id,p_supplier_id,p_invoice_no,p_lines
  );
  v_purchase_id := (v_result->>'purchase_id')::uuid;
  if v_purchase_id is null then raise exception 'purchase_creation_failed'; end if;

  update public.gmp_purchases p
    set source_document_id=p_source_document_id
    where p.id=v_purchase_id and p.organization_id=p_organization_id;
  if not found then raise exception 'purchase_document_link_failed'; end if;

  return v_result || jsonb_build_object('source_document_id',p_source_document_id,'already_linked',false);
end;
$$;

revoke all on function public.gmp_create_purchase_from_document(uuid,uuid,uuid,uuid,text,jsonb,uuid) from public,anon;
grant execute on function public.gmp_create_purchase_from_document(uuid,uuid,uuid,uuid,text,jsonb,uuid) to authenticated;
