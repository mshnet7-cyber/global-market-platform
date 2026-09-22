import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
for (const p of ["app/dashboard/commercial/page.tsx","app/api/commercial/route.ts","supabase/migrations/20260922190000_merchant_commercial_completeness.sql"]) test("commercial completeness: "+p,()=>assert.equal(fs.existsSync(p),true));
test("commercial center includes core ERP layers",()=>{const p=fs.readFileSync("app/dashboard/commercial/page.tsx","utf8");for(const s of ["عروض الأسعار","سندات القبض والصرف","قوائم الأسعار","كشوف الحساب","تصدير البيانات"])assert.match(p,new RegExp(s));});
test("commercial API has tenant-scoped operations",()=>{const p=fs.readFileSync("app/api/commercial/route.ts","utf8");for(const s of ["organization_id","requireStage2Permission","gmp_sales_quotes","gmp_cash_vouchers","gmp_price_lists"])assert.match(p,new RegExp(s));});
