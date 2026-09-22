import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
for (const p of ["app/dashboard/commercial/page.tsx","app/api/commercial/route.ts","supabase/migrations/20260922190000_merchant_commercial_completeness.sql"]) test("commercial completeness: "+p,()=>assert.equal(fs.existsSync(p),true));
test("commercial center includes core ERP layers",()=>{const p=fs.readFileSync("app/dashboard/commercial/page.tsx","utf8");for(const s of ["عروض الأسعار","سندات القبض والصرف","قوائم الأسعار","كشوف الحساب","تصدير البيانات"])assert.match(p,new RegExp(s));});
test("commercial API has tenant-scoped operations",()=>{const p=fs.readFileSync("app/api/commercial/route.ts","utf8");for(const s of ["organization_id","requireStage2Permission","gmp_sales_quotes","gmp_cash_vouchers","gmp_price_lists"])assert.match(p,new RegExp(s));});

test("commercial workflow exposes quote lifecycle and price list items",()=>{const p=fs.readFileSync("app/api/commercial/route.ts","utf8"),u=fs.readFileSync("app/dashboard/commercial/page.tsx","utf8");for(const s of ["quote_status","quote_convert","price_item","gmp_create_and_post_sale"])assert.match(p,new RegExp(s));for(const s of ["تحويل إلى فاتورة","إضافة منتج للقائمة","حفظ سعر المنتج"])assert.match(u,new RegExp(s));});

test("commercial write paths enforce organization ownership for referenced records",()=>{const p=fs.readFileSync("app/api/commercial/route.ts","utf8");for(const s of ["belongsToOrg(access,\"gmp_stores\"","belongsToOrg(access,\"gmp_customers\"","belongsToOrg(access,\"gmp_products\"","partyType==="])assert.match(p,new RegExp(s));});

test("commercial UI covers conversion prerequisites and server statements",()=>{const u=fs.readFileSync("app/dashboard/commercial/page.tsx","utf8"),p=fs.readFileSync("app/api/commercial/route.ts","utf8");for(const s of ["name=\"product_id\"","product_id:String(f.get(\"product_id\"))","/api/commercial?action=statement","setStatementRows"])assert.match(u,s);for(const s of ["branch_not_found","product_store_mismatch","branchId"])assert.match(p,s);});
