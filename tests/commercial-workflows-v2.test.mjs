import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("commercial workflow APIs and UI are present",()=>{
 const api=fs.readFileSync("app/api/commercial/route.ts","utf8");
 const page=fs.readFileSync("app/dashboard/commercial/page.tsx","utf8");
 const migration=fs.readFileSync("supabase/migrations/20260923010000_commercial_quote_workflows.sql","utf8");
 assert.match(api,/gmp_set_sales_quote_status/);
 assert.match(api,/gmp_convert_sales_quote/);
 assert.match(api,/price_list_item/);
 assert.match(page,/تحويل لفاتورة/);
 assert.match(page,/price_list_item/);
 assert.match(migration,/organization_write_forbidden/);
 assert.match(migration,/for update/);
});
