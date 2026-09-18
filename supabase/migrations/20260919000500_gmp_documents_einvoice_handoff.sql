-- OCR to e-invoice handoff.
alter table public.gmp_einvoice_submissions add column if not exists source_document_id uuid references public.gmp_documents(id) on delete set null;
alter table public.gmp_einvoice_submissions add column if not exists payload jsonb not null default '{}'::jsonb;

-- Private server-managed document bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gmp-documents','gmp-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
