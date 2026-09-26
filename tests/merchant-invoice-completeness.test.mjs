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

test("approved supplier invoice conversion creates an atomic draft purchase with tenant and idempotency guards", () => {
  const migration = readFileSync("supabase/migrations/20260927010000_gmp_purchase_from_invoice_v1.sql", "utf8");
  const api = readFileSync("app/api/stage2/route.ts", "utf8");
  const documents = readFileSync("app/dashboard/documents/page.tsx", "utf8");
  for (const token of ["source_document_id", "document_type='supplier_invoice'", "review_status='approved'", "for update", "gmp_create_purchase(", "already_linked", "security definer", "grant execute"]) assert.ok(migration.includes(token), token);
  assert.ok(migration.includes("gmp_purchases_organization_source_document_uidx"));
  assert.ok(api.includes('requirePermission("erp.write"'));
  assert.ok(api.includes('rpc("gmp_create_purchase_from_document"'));
  assert.ok(documents.includes('doc.document_type!=="supplier_invoice"||doc.review_status!=="approved"'));
  assert.ok(documents.includes("راجع القيم يدويًا"));
  assert.ok(documents.includes("لم تتم إضافة أي كمية إلى المخزون"));
});
