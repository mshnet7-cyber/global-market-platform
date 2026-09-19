-- P1 performance index for OCR -> e-invoice linkage.
create index if not exists gmp_einvoice_submissions_source_document_idx
  on public.gmp_einvoice_submissions(source_document_id);
