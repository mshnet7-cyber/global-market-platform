import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20260922010000_gmp_purchase_receiving_v1.sql","utf8");
function ok(name,c){if(!c)throw new Error(name);}
ok("received quantities tracked",migration.includes("received_quantity")&&migration.includes("received_weight_grams"));
ok("tenant scope",migration.includes("m.organization_id=v_purchase.organization_id"));
ok("product store scope",migration.includes("p.store_id=v_purchase.store_id"));
ok("inventory updated",migration.includes("current_quantity=current_quantity+v_qty"));
ok("inventory movement posted",migration.includes("gmp_inventory_movements")&&migration.includes("'purchase'"));
ok("accounting posted",migration.includes("system_key='payables'")&&migration.includes("purchase_receipt"));
ok("journal balanced",migration.includes("unbalanced purchase receipt"));
ok("execution restricted",migration.includes("revoke all on function public.gmp_receive_purchase")&&migration.includes("grant execute"));
console.log("purchase-receiving: 8 checks passed");