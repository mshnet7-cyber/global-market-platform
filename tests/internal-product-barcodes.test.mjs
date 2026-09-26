import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { code128BModules } from "../lib/code128.js";

test("Code 128-B encodes printable ASCII with the expected check symbol and stop pattern", () => {
  assert.equal(code128BModules("A"), "2112141113231311232331112");
  assert.equal(code128BModules("AG"), "2112141113232113132212132331112");
  assert.ok(/^[1-4]+$/.test(code128BModules("AG000000000001")));
  assert.throws(() => code128BModules("ذهب"), /code128_ascii_required/);
  assert.throws(() => code128BModules(""), /code128_value_invalid/);
});

test("barcode label UI and database generation stay connected to product creation", () => {
  const migration = readFileSync("supabase/migrations/20260927020000_gmp_internal_product_barcodes_v1.sql", "utf8");
  const api = readFileSync("app/api/stage2/route.ts", "utf8");
  const page = readFileSync("app/dashboard/operations/page.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.ok(migration.includes("gmp_internal_product_barcodes"));
  assert.ok(migration.includes("nextval('public.gmp_internal_product_barcode_seq')"));
  assert.ok(migration.includes("gmp_create_inventory_product("));
  assert.ok(migration.includes("set search_path = ''"));
  assert.ok(api.includes('rpc("gmp_create_inventory_product_with_barcode"'));
  assert.ok(page.includes("code128BModules(value)"));
  assert.ok(page.includes("barcode_generated"));
  assert.ok(page.includes("طباعة الملصق"));
  assert.ok(css.includes(".barcode-print-root"));
});
