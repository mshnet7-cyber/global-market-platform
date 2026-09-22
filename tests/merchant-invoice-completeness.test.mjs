import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("merchant invoice center and finance routes exist", () => {
  for (const path of [
    "app/dashboard/invoices/page.tsx",
    "app/dashboard/accounting/page.tsx",
    "app/dashboard/tax/page.tsx",
    "app/dashboard/purchases/page.tsx",
    "app/dashboard/inventory/page.tsx",
    "app/dashboard/expenses/page.tsx"
  ]) assert.equal(existsSync(path), true, path);
});

test("POS supports the invoice fields already accepted by the atomic sales API", () => {
  const text = readFileSync("app/dashboard/sales/SalesForm.tsx","utf8");
  for (const token of ["customer_id","discount_amount","vat_amount","making_charge","notes","lines","/dashboard/invoices"]) assert.ok(text.includes(token), token);
});
