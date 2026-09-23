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
 assert.doesNotMatch(api,/gmp_branches.*store_id/);
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

test("quote creation enforces financial totals at the database boundary",()=>{
 const migration=fs.readFileSync("supabase/migrations/20260923023000_commercial_quote_total_integrity.sql","utf8");
 assert.match(migration,/calculated_subtotal/);
 assert.match(migration,/quote_subtotal_mismatch/);
 assert.match(migration,/quote_total_mismatch/);
 assert.match(migration,/calculated_total/);
 assert.match(migration,/round\(calculated_subtotal,3\)/);
 assert.match(migration,/security invoker/);
 assert.doesNotMatch(migration,/b\.store_id/);
});

test("cash vouchers use the atomic database numbering boundary",()=>{
 const api=fs.readFileSync("app/api/commercial/route.ts","utf8");
 const migration=fs.readFileSync("supabase/migrations/20260923024000_commercial_cash_voucher_atomic.sql","utf8");
 assert.match(api,/gmp_create_cash_voucher/);
 assert.doesNotMatch(api,/Math\.random\(\)/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/gmp-cash-voucher/);
 assert.match(migration,/organization_write_forbidden/);
 assert.match(migration,/grant execute.*authenticated/si);
});

test("price list writes enforce database scope and preserve zero prices",()=>{
 const api=fs.readFileSync("app/api/commercial/route.ts","utf8");
 const migration=fs.readFileSync("supabase/migrations/20260923025000_commercial_price_list_scope.sql","utf8");
 assert.match(api,/sell_price:b\.sell_price===null\|\|b\.sell_price===undefined\?null:num\(b\.sell_price\)/);
 assert.match(api,/buy_price:b\.buy_price===null\|\|b\.buy_price===undefined\?null:num\(b\.buy_price\)/);
 assert.match(migration,/store_organization_mismatch/);
 assert.match(migration,/product_organization_mismatch/);
 assert.match(migration,/product_store_mismatch/);
 assert.match(migration,/gmp_price_lists_scope_trg/);
 assert.match(migration,/gmp_price_list_items_scope_trg/);
 assert.match(migration,/security invoker/);
});

test("merchant operation writes enforce database tenant scope",()=>{
 const migration=fs.readFileSync("supabase/migrations/20260923026000_merchant_operation_scope.sql","utf8");
 assert.match(migration,/gmp_repair_orders_scope_trg/);
 assert.match(migration,/gmp_person_gold_purchases_scope_trg/);
 assert.match(migration,/branch_organization_mismatch/);
 assert.match(migration,/customer_organization_mismatch/);
 assert.match(migration,/store_organization_mismatch/);
 assert.match(migration,/security invoker/);
});


test("public localization and Omani Rial sign are wired consistently",()=>{
 const config=fs.readFileSync("lib/config.ts","utf8");
 const layout=fs.readFileSync("app/layout.tsx","utf8");
 const home=fs.readFileSync("app/page.tsx","utf8");
 const prefs=fs.readFileSync("components/DisplayPreferences.tsx","utf8");
 const i18n=fs.readFileSync("lib/i18n.ts","utf8");
 const money=fs.readFileSync("lib/currency-display.ts","utf8");
 const moneyComponent=fs.readFileSync("components/MoneyDisplay.tsx","utf8");
 const section=fs.readFileSync("app/[section]/page.tsx","utf8");
 assert.match(config,/SUPPORTED_PUBLIC_LANGUAGES = \["ar", "en", "bn", "ur", "hi"\]/);
 assert.match(layout,/SUPPORTED_PUBLIC_LANGUAGES/);
 for (const code of ["ar","en","bn","ur","hi"]) assert.match(i18n,new RegExp("\\b"+code+": \\{"));
 assert.match(prefs,/bn/); assert.match(prefs,/ur/); assert.match(prefs,/hi/);
 assert.match(home,/SUPPORTED_PUBLIC_LANGUAGES/);
 assert.match(section,/currencies/);
 assert.match(section,/snapshot\.currencies/);
 assert.match(money,/U\\+20C4 OMANI RIAL SIGN/);
 assert.match(money,/\\u20C4/);
 assert.match(moneyComponent,/omr-symbol/);
});

test("public snapshot exposes reference FX data and licensed market/news providers",()=>{
 const providers=fs.readFileSync("lib/providers/index.ts","utf8");
 const marketData=fs.readFileSync("lib/providers/market-data.ts","utf8");
 const freeData=fs.readFileSync("lib/free-data.ts","utf8");
 assert.match(providers,/getPublicCurrencyQuotes/);
 assert.match(providers,/Frankfurter \/ ECB reference/);
 assert.match(marketData,/MARKET_DATA_DISPLAY_LICENSED/);
 assert.match(freeData,/fetchMarketaux/);
 assert.match(freeData,/fetchNewsData/);
});
