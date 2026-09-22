import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("commercial workflow APIs and UI are present",()=>{
 const api=fs.readFileSync("app/api/commercial/route.ts","utf8");
 const page=fs.readFileSync("app/dashboard/commercial/page.tsx","utf8");
 const migration=fs.readFileSync("supabase/migrations/20260923010000_commercial_quote_workflows.sql","utf8");
 assert.match(api,/gmp_set_sales_quote_status/);
 assert.match(api,/gmp_convert_sales_quote/);
 assert.match(api,/gmp_create_sales_quote/);
 assert.doesNotMatch(api,/from\("gmp_sales_quotes"\)\.insert/);
 assert.match(api,/price_item/);
 assert.match(page,/تحويل إلى فاتورة/);
 assert.match(page,/حفظ سعر المنتج/);
 assert.match(migration,/organization_write_forbidden/);
 assert.match(migration,/for update/);
 const atomicMigration=fs.readFileSync("supabase/migrations/20260923022000_commercial_quote_creation_atomic.sql","utf8");
 assert.match(atomicMigration,/security invoker/);
 assert.match(atomicMigration,/gmp_sales_quotes/);
 assert.match(atomicMigration,/gmp_sales_quote_lines/);
 assert.match(atomicMigration,/insert into public.gmp_sales_quotes/);
 assert.match(atomicMigration,/insert into public.gmp_sales_quote_lines/);
});

test("commercial database hardening is encoded",()=>{
 const migration=fs.readFileSync("supabase/migrations/20260923020000_commercial_integrity_query_hardening.sql","utf8");
 assert.match(migration,/create unique index if not exists gmp_sales_quotes_converted_sale_unique_idx/);
 assert.match(migration,/gmp_sales_quotes_conversion_state_ck/);
 assert.match(migration,/gmp_gold_buybacks_member_read/);
 assert.match(migration,/gmp_purchase_receipt_idempotency_member_read/);
 assert.match(migration,/for select to authenticated/);
 assert.match(migration,/gmp_gold_price_rules_admin_insert/);
 assert.doesNotMatch(migration,/for all to authenticated/);
});

test("quote RPCs use invoker security and fail-closed conversion state",()=>{
 const migration=fs.readFileSync("supabase/migrations/20260923021000_commercial_quote_least_privilege.sql","utf8");
 assert.match(migration,/gmp_set_sales_quote_status/);
 assert.match(migration,/security invoker/);
 assert.match(migration,/gmp_convert_sales_quote/);
 assert.match(migration,/quote_conversion_state_invalid/);
 assert.match(migration,/sale_conversion_missing_id/);
});
