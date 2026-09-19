-- Cover the actual screen_id foreign key with a leftmost single-column index.
create index if not exists gmp_display_content_screen_id_idx on public.gmp_display_content(screen_id);
