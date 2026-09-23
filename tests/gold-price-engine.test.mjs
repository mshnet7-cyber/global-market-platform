import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20260921013000_gmp_gold_price_engine_v1.sql","utf8");
function ok(name,c){if(!c)throw new Error(name);}
ok("central calculator exists",migration.includes("gmp_calculate_gold_shop_price"));
ok("market price stays the base",migration.includes("p_market_price_24k_per_gram * (p_karat / 24.0)"));
ok("store rules override org rules",migration.includes("case when r.store_id=p_store_id then 0 else 1 end"));
ok("percentage and fixed adjustments",migration.includes("when 'percentage'")&&migration.includes("v_base + v_rule.adjustment_value"));
ok("sell margin floor",migration.includes("greatest(v_price, v_base + v_rule.min_margin_per_gram)"));
ok("making charge is weight-based",migration.includes("v_rule.making_charge_per_gram")&&migration.includes("p_weight_grams"));
ok("API access is authenticated",migration.includes("revoke all on function public.gmp_calculate_gold_shop_price")&&migration.includes("grant execute"));
console.log("gold-price-engine: 7 checks passed");
