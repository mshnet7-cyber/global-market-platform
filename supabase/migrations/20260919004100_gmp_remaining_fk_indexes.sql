-- Complete launch FK coverage for remaining Global Market relations.
create index if not exists gmp_display_content_screen_idx on public.gmp_display_content(screen_id);
create index if not exists gmp_member_permissions_user_idx on public.gmp_member_permissions(user_id);
