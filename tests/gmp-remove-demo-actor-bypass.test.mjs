import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260921011000_gmp_remove_demo_actor_bypass_v1.sql",
  "utf8",
);

function ok(name, condition) {
  if (!condition) throw new Error(name);
}

ok("targets sensitive RPCs", migration.includes("gmp_create_and_post_sale") &&
  migration.includes("gmp_create_purchase") &&
  migration.includes("gmp_create_and_post_expense") &&
  migration.includes("gmp_create_inventory_product") &&
  migration.includes("gmp_create_manual_journal"));

ok("removes hardcoded demo organization actor mapping",
  migration.includes("v_actor uuid := (select auth.uid());") &&
  migration.includes("b46e15af-2ffd-4775-b0d7-7d84fef4b749"));

ok("does not grant anon execution",
  migration.includes("REVOKE ALL ON FUNCTION public.gmp_create_and_post_sale") &&
  migration.includes("REVOKE ALL ON FUNCTION public.gmp_create_purchase"));

console.log("gmp-remove-demo-actor-bypass: 3 checks passed");
