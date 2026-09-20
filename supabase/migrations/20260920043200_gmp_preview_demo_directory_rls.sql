grant select, insert, update on table public.gmp_store_directory to anon;

drop policy if exists gmp_demo_preview_shop_directory_read on public.gmp_store_directory;
create policy gmp_demo_preview_shop_directory_read on public.gmp_store_directory for select to anon
using (
  store_id = '34157c9e-d109-41a3-a199-9bf2e2a54624'::uuid
  and status = 'published'
  and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);

drop policy if exists gmp_demo_preview_shop_directory_update on public.gmp_store_directory;
create policy gmp_demo_preview_shop_directory_update on public.gmp_store_directory for update to anon
using (
  store_id = '34157c9e-d109-41a3-a199-9bf2e2a54624'::uuid
  and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
)
with check (
  store_id = '34157c9e-d109-41a3-a199-9bf2e2a54624'::uuid
  and coalesce((nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-gmp-demo-role'), '') = 'shop_owner'
);
