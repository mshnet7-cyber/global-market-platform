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

test("Public marketplace order RPC is server-only",()=>{ const m=read("supabase/migrations/20260918204610_gmp_marketplace_rpc_security_hardening_20260919.sql"); assert.match(m,/revoke execute on function public\.gmp_create_marketplace_order/); assert.match(m,/from anon,authenticated/); });

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






test("Stage 2 transaction RPCs are hardened and preview demo access stays server-side",()=>{
  const src=read("app/api/stage2/route.ts");
  assert.match(src,/createSupabaseAdminClient/);
  assert.doesNotMatch(src,/createSupabaseDemoClient/);
  assert.match(src,/getDemoSession/);
  assert.match(src,/x-gmp-demo-role/);
  assert.match(src,/rpc\("gmp_create_inventory_product"/);
  assert.match(src,/rpc\("gmp_create_and_post_sale"/);
  assert.match(src,/rpc\("gmp_create_purchase"/);
  assert.match(src,/rpc\("gmp_create_and_post_expense"/);
  assert.match(src,/rpc\("gmp_create_manual_journal"/);
  const admin=read("app/api/admin/overview/route.ts");
  assert.match(admin,/createSupabaseAdminClient/);
  assert.doesNotMatch(admin,/createSupabaseDemoClient/);
  const merchant=read("lib/merchant-access.ts");
  assert.match(merchant,/createSupabaseAdminClient/);
  assert.match(merchant,/x-gmp-demo-role.*shop_owner/);
  assert.doesNotMatch(merchant,/createSupabaseDemoClient/);
  const adminClient=read("lib/supabase/admin.ts");
  assert.match(adminClient,/headers\?: Record<string, string>/);
  assert.match(adminClient,/global: headers \? \{ headers \} : undefined/);
  const hardening=read("supabase/migrations/20260920060000_gmp_preview_demo_server_only.sql");
  assert.match(hardening,/drop policy if exists %I/);
  assert.match(hardening,/revoke all privileges on table/);
  assert.match(hardening,/revoke execute on function public\.gmp_create_inventory_product/);
  assert.match(hardening,/from anon/);
  assert.match(read("supabase/migrations/20260920012655_gmp_fix_stage2_transaction_auth_and_rls_20260920.sql"),/SECURITY DEFINER/);
});

test("Stage 2 schema compatibility fixes are tracked",()=>{
  assert.match(read("supabase/migrations/20260920012226_gmp_fix_stage2_store_active_column_20260920.sql"),/gmp_stores/);
  assert.match(read("supabase/migrations/20260920012330_gmp_fix_stage2_sale_generated_line_total_20260920.sql"),/line_total/);
  assert.match(read("supabase/migrations/20260920012448_gmp_fix_stage2_supplier_active_column_20260920.sql"),/gmp_suppliers/);
});


test("Browser state-changing merchant APIs enforce same-origin requests",()=>{
  const guarded=[
    "app/api/admin/overview/route.ts",
    "app/api/alerts/rules/route.ts",
    "app/api/displays/create/route.ts",
    "app/api/displays/pair-code/route.ts",
    "app/api/displays/revoke/route.ts",
    "app/api/merchant/cameras/route.ts",
    "app/api/merchant/compliance/route.ts",
    "app/api/merchant/documents/route.ts",
    "app/api/merchant/invoicing/route.ts",
    "app/api/merchant/operations/route.ts",
    "app/api/merchant/sales/route.ts",
    "app/api/notifications/route.ts",
    "app/api/stage2/route.ts",
    "app/api/stage3/ai/route.ts",
    "app/api/stage3/billing/route.ts",
    "app/api/stage3/einvoice/route.ts",
    "app/api/stage3/whatsapp/route.ts",
    "app/api/stores/create/route.ts",
    "app/api/v1/keys/route.ts",
    "app/api/dashboard/webhooks/route.ts"
  ];
  for(const file of guarded){
    const src=read(file);
    assert.match(src,/isSameOriginRequest/);
    assert.match(src,/cross_site_request/);
  }
});

test("External device endpoints remain token/session-authenticated rather than browser-origin guarded",()=>{
  const heartbeat=read("app/api/displays/heartbeat/route.ts");
  const pair=read("app/api/displays/pair/route.ts");
  const snapshot=read("app/api/displays/snapshot/route.ts");
  assert.match(heartbeat,/session_hash|x-gmp/i);
  assert.match(pair,/pairing|pair_code/i);
  assert.match(snapshot,/session_hash|session/i);
});

test("Anonymous GMP table mutations are disabled at the database layer",()=>{
  const m=read("supabase/migrations/20260920023000_gmp_revoke_anon_mutations.sql");
  assert.match(m,/revoke insert, update, delete, truncate, references, trigger on table/i);
  assert.match(m,/c\.relname like 'gmp_%'/);
  assert.match(m,/from anon/);
});

test("Stage 2 demo actor override is service-role bound",()=>{
  const m=read("supabase/migrations/20260920033811_gmp_stage2_demo_service_role_guard_v1.sql");
  assert.match(m,/auth\.role\(\)/);
  assert.match(m,/service_role/);
  assert.match(m,/x-gmp-demo-role/);
  assert.match(m,/updated_count <> 5/);
});
