import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260921010000_gmp_gold_ledger_foundation_v1.sql", "utf8");

function ok(name, condition) {
  if (!condition) throw new Error(name);
}

ok("gold price rules table", migration.includes("create table if not exists public.gmp_gold_price_rules"));
ok("immutable gold ledger table", migration.includes("create table if not exists public.gmp_gold_ledger_entries"));
ok("gold ledger tracks karat", migration.includes("karat numeric(6,3)"));
ok("gold ledger tracks gross/net/stone weight", migration.includes("gross_weight_grams") && migration.includes("stone_weight_grams") && migration.includes("net_weight_grams"));
ok("pure gold weight is deterministic", migration.includes("pure_gold_weight_grams numeric(20,6) generated always as"));
ok("ledger is idempotent", migration.includes("gmp_gold_ledger_idempotency_uniq") && migration.includes("p_idempotency_key"));
ok("ledger is tenant scoped", migration.includes("organization_id uuid not null references public.gmp_organizations"));
ok("ledger has RLS", migration.includes("alter table public.gmp_gold_ledger_entries enable row level security"));
ok("ledger has no update/delete policy", !migration.includes("gmp_gold_ledger_entries_admin_update") && !migration.includes("gmp_gold_ledger_entries_admin_delete"));
ok("posting is authenticated and admin-gated", migration.includes("security invoker") && migration.includes("grant execute on function public.gmp_post_gold_ledger_entry") && migration.includes("m.role in ('owner','admin')"));
ok("balance view is derived from ledger", migration.includes("create or replace view public.gmp_gold_store_balances") && migration.includes("sum(case when direction='in'"));
console.log("gold-ledger-foundation: 11 checks passed");
