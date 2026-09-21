import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260921012000_gmp_gold_ledger_inventory_bridge_v1.sql",
  "utf8",
);

function ok(name, condition) {
  if (!condition) throw new Error(name);
}

ok("inventory trigger exists", migration.includes("gmp_inventory_movement_gold_ledger"));
ok("trigger maps inventory direction", migration.includes("when 'purchase' then 'in'") && migration.includes("when 'sale' then 'out'"));
ok("gold products only", migration.includes("v_karat := nullif((regexp_match"));
ok("ledger is idempotent per movement", migration.includes("'inventory-movement:' || new.id::text") && migration.includes("on conflict (organization_id, idempotency_key) do nothing"));
ok("inventory valuation is used", migration.includes("new.quantity") && migration.includes("new.unit_cost"));
ok("trigger function is not callable by API roles", migration.includes("revoke all on function public.gmp_sync_gold_ledger_from_inventory_movement() from public, anon, authenticated"));

console.log("gold-ledger-inventory-bridge: 6 checks passed");
