-- Stage 3 defense-in-depth. No destructive data operations.
create index if not exists gmp_ai_jobs_created_by_idx on public.gmp_ai_jobs(created_by);
create index if not exists gmp_whatsapp_messages_created_by_idx on public.gmp_whatsapp_messages(created_by);
create index if not exists gmp_billing_events_subscription_idx on public.gmp_billing_events(subscription_id);
create index if not exists gmp_billing_events_payment_idx on public.gmp_billing_events(payment_id);

drop policy if exists gmp_ai_jobs_admin_write on public.gmp_ai_jobs;
create policy gmp_ai_jobs_admin_insert on public.gmp_ai_jobs for insert to authenticated with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_ai_jobs.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin')));
create policy gmp_ai_jobs_admin_update on public.gmp_ai_jobs for update to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_ai_jobs.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin'))) with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_ai_jobs.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin')));
create policy gmp_ai_jobs_admin_delete on public.gmp_ai_jobs for delete to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_ai_jobs.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin')));

drop policy if exists gmp_whatsapp_messages_admin_write on public.gmp_whatsapp_messages;
create policy gmp_whatsapp_messages_admin_insert on public.gmp_whatsapp_messages for insert to authenticated with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_whatsapp_messages.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin')));
create policy gmp_whatsapp_messages_admin_update on public.gmp_whatsapp_messages for update to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_whatsapp_messages.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin'))) with check (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_whatsapp_messages.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin')));
create policy gmp_whatsapp_messages_admin_delete on public.gmp_whatsapp_messages for delete to authenticated using (exists(select 1 from public.gmp_organization_members m where m.organization_id=gmp_whatsapp_messages.organization_id and m.user_id=(select auth.uid()) and m.role in('owner','admin')));

create or replace function public.gmp_stage3_validate_scope() returns trigger
language plpgsql security definer set search_path=public
as $$
declare owner_org uuid;
begin
  if tg_table_name='gmp_ai_jobs' and new.document_id is not null then
    select organization_id into owner_org from public.gmp_documents where id=new.document_id;
    if owner_org is null or owner_org<>new.organization_id then raise exception 'stage3_cross_tenant_document_reference'; end if;
  elsif tg_table_name='gmp_billing_events' then
    if new.subscription_id is not null then
      select organization_id into owner_org from public.gmp_subscriptions where id=new.subscription_id;
      if owner_org is null or owner_org<>new.organization_id then raise exception 'stage3_cross_tenant_subscription_reference'; end if;
    end if;
    if new.payment_id is not null then
      select organization_id into owner_org from public.gmp_payments where id=new.payment_id;
      if owner_org is null or owner_org<>new.organization_id then raise exception 'stage3_cross_tenant_payment_reference'; end if;
    end if;
  elsif tg_table_name='gmp_api_usage_events' then
    if new.organization_id is not null then
      select organization_id into owner_org from public.gmp_api_keys where id=new.api_key_id;
      if owner_org is null or owner_org<>new.organization_id then raise exception 'stage3_cross_tenant_api_key_reference'; end if;
    end if;
  elsif tg_table_name='gmp_einvoice_attempts' then
    select organization_id into owner_org from public.gmp_einvoice_submissions s where s.id=new.submission_id;
    if owner_org is null then raise exception 'stage3_invalid_einvoice_submission'; end if;
  end if;
  return new;
end;
$$;
revoke all on function public.gmp_stage3_validate_scope() from public,anon,authenticated;
drop trigger if exists gmp_stage3_scope_ai_jobs on public.gmp_ai_jobs;
create trigger gmp_stage3_scope_ai_jobs before insert or update on public.gmp_ai_jobs for each row execute function public.gmp_stage3_validate_scope();
drop trigger if exists gmp_stage3_scope_billing_events on public.gmp_billing_events;
create trigger gmp_stage3_scope_billing_events before insert or update on public.gmp_billing_events for each row execute function public.gmp_stage3_validate_scope();
drop trigger if exists gmp_stage3_scope_api_usage on public.gmp_api_usage_events;
create trigger gmp_stage3_scope_api_usage before insert or update on public.gmp_api_usage_events for each row execute function public.gmp_stage3_validate_scope();
drop trigger if exists gmp_stage3_scope_einvoice_attempts on public.gmp_einvoice_attempts;
create trigger gmp_stage3_scope_einvoice_attempts before insert or update on public.gmp_einvoice_attempts for each row execute function public.gmp_stage3_validate_scope();
