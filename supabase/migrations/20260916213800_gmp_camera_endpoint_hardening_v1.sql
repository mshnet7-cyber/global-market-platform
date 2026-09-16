alter table public.gmp_cameras add column if not exists endpoint_url text;
alter table public.gmp_cameras drop constraint if exists gmp_cameras_endpoint_url_check;
alter table public.gmp_cameras add constraint gmp_cameras_endpoint_url_check check (endpoint_url is null or length(endpoint_url) <= 2000);