-- Launch performance hardening: cover foreign keys used by tenant-scoped queries and cascades.
create index if not exists gmp_ad_creatives_org_idx on public.gmp_ad_creatives(organization_id);
create index if not exists gmp_ad_placements_creative_idx on public.gmp_ad_placements(creative_id);
create index if not exists gmp_ad_placements_org_idx on public.gmp_ad_placements(organization_id);
create index if not exists gmp_ad_placements_store_idx on public.gmp_ad_placements(store_id);
create index if not exists gmp_display_content_org_idx on public.gmp_display_content(organization_id);
create index if not exists gmp_display_schedules_content_idx on public.gmp_display_schedules(content_id);
create index if not exists gmp_display_schedules_org_idx on public.gmp_display_schedules(organization_id);
create index if not exists gmp_display_schedules_store_idx on public.gmp_display_schedules(store_id);
create index if not exists gmp_marketplace_listings_org_idx on public.gmp_marketplace_listings(organization_id);
create index if not exists gmp_marketplace_order_lines_listing_idx on public.gmp_marketplace_order_lines(listing_id);
