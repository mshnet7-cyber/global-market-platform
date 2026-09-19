import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p)=>readFileSync(p,"utf8");

test("Stage 2 core surfaces exist",()=>{
  assert.match(read("app/dashboard/operations/page.tsx"),/السوق|marketplace/i);
  assert.match(read("app/directory/page.tsx"),/دليل محلات الذهب/);
  assert.match(read("app/marketplace/page.tsx"),/no paid checkout|بدون دفع/i);
  assert.match(read("app/store/[slug]/page.tsx"),/status.*published/);
  assert.match(read("app/admin/page.tsx"),/إدارة المنصة/);
});

test("Stage 2 API keeps tenant boundaries and uses existing pricing/transaction primitives",()=>{
  const src=read("app/api/stage2/route.ts");
  assert.match(src,/organization_id/);
  assert.match(src,/gmp_create_and_post_sale/);
  assert.match(src,/gmp_create_inventory_product/);
  assert.match(src,/gmp_create_purchase/);
  assert.match(src,/gmp_create_and_post_expense/);
  assert.match(src,/gmp_create_manual_journal/);
  assert.match(src,/gmp_create_marketplace_order/);
  assert.match(src,/gmp_store_directory/);
  assert.match(src,/gmp_marketplace_listings/);
});

test("Stage 2 permissions support explicit delegated grants",()=>{
  const src=read("lib/stage2-access.ts");
  assert.match(src,/enabled === true.*permissions\.add/s);
  assert.match(src,/enabled === false.*permissions\.delete/s);
});

test("Stage 2 database foundation has RLS and idempotency",()=>{
  const src=read("supabase/migrations/20260917233033_gmp_merchant_marketplace_stage2_core.sql");
  assert.match(src,/enable row level security/);
  assert.match(src,/gmp_store_directory_public_read/);
  assert.match(src,/gmp_marketplace_listings_public_read/);
  assert.match(src,/gmp_member_permissions_admin_all/);
  const id=read("supabase/migrations/20260917233748_gmp_stage2_order_idempotency.sql");
  assert.match(id,/create unique index/i);
  const scope=read("supabase/migrations/20260918011943_gmp_stage2_scope_hardening.sql");
  assert.match(scope,/gmp_stage2_validate_reference_scope/);
  assert.match(scope,/gmp_stage2_scope_ad_placements/);
});

test("Display runtime consumes Stage 2 content and advertising",()=>{
  const api=read("app/api/displays/snapshot/route.ts");
  const screen=read("app/screen/page.tsx");
  assert.match(api,/gmp_display_schedules/);
  assert.match(api,/gmp_ad_placements/);
  assert.match(api,/content:/);
  assert.match(api,/ads/);
  assert.match(screen,/screen-content-area/);
});

test("Repair lifecycle matches database statuses",()=>{
  assert.match(read("app/api/stage2/route.ts"),/in_repair/);
  assert.doesNotMatch(read("app/api/stage2/route.ts"),/statuses:\["received","in_progress"/);
});

test("Public APIs do not expose internal marketplace metadata or organization IDs",()=>{ const api=read("app/api/stage2/route.ts"); assert.match(api,/gmp_marketplace_listings.*select\("id,store_id,listing_type,title,description,category,price,currency,availability,contact_mode,image_path,updated_at"\)/s); assert.doesNotMatch(api,/action === "marketplace"[\s\S]{0,2500}organization_id/); });

test("Public store profiles require publication",()=>{ const src=read("app/store/[slug]/page.tsx"); assert.match(src,/notFound\(\)/); assert.match(src,/eq\("status","published"\)/); assert.match(read("app/directory/page.tsx"),/safeWebsite/); });

test("Public marketplace order RPC is server-only",()=>{ const m=read("supabase/migrations/20260919000600_gmp_marketplace_rpc_security_hardening.sql"); assert.match(m,/revoke execute on function public\.gmp_create_marketplace_order/); assert.match(m,/from anon,authenticated/); });

test("No Stage 2 paid checkout or external Stage 3 features",()=>{
  const src=read("app/marketplace/page.tsx");
  assert.doesNotMatch(src,/stripe|checkout\\.com|payment_intent/i);
  assert.match(src,/payment-free|بدون دفع/i);
});


test("Public store response scopes branches to the requested store branch",()=>{
 const src=read("app/api/stage2/route.ts");
 assert.match(src,/branch_id,name,slug/);
 assert.match(src,/\.eq\("id", store\.branch_id\)/);
 assert.doesNotMatch(src,/\.eq\("organization_id", store\.organization_id\)\.eq\("active",true\)\.order\("name"\)/);
});


test("RLS consolidation removes overlapping permissive policies",()=>{\n const src=read("supabase/migrations/20260919010000_gmp_rls_policy_consolidation.sql");\n assert.match(src,/gmp_ad_creatives_admin_insert/); assert.match(src,/gmp_ad_placements_admin_update/); assert.match(src,/gmp_display_content_admin_delete/); assert.match(src,/gmp_display_schedules_admin_insert/); assert.match(src,/gmp_marketplace_listings_select/); assert.match(src,/gmp_store_directory_select/);\n});
