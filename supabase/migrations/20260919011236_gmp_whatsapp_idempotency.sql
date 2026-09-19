alter table public.gmp_whatsapp_messages
  add column if not exists idempotency_key text;

create unique index if not exists gmp_whatsapp_messages_org_idempotency_key
  on public.gmp_whatsapp_messages(organization_id, idempotency_key)
  where idempotency_key is not null;
