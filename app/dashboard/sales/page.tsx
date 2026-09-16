import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import SalesForm from "./SalesForm";

export default async function SalesPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?next=/dashboard/sales");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/sales");

  const { data: organization } = await supabase.from("gmp_organizations").select("id").eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!organization) redirect("/signup?error=account_setup");
  const { data: subscription } = await supabase.from("gmp_subscriptions").select("status,current_period_end,gmp_plans(code)").eq("organization_id", organization.id).maybeSingle();
  const plan = Array.isArray(subscription?.gmp_plans) ? subscription?.gmp_plans[0] : subscription?.gmp_plans;
  if (!["pro", "business"].includes(String(plan?.code)) || (subscription?.current_period_end && new Date(subscription.current_period_end).getTime() < Date.now())) {
    redirect("/pricing");
  }

  const { data: stores } = await supabase.from("gmp_stores").select("id,name,branch_id,currency").eq("organization_id", organization.id).order("created_at", { ascending: true });
  const { data: products } = await supabase.from("gmp_products").select("id,name,sku,barcode,karat,weight_grams,price,making_charge,currency,current_quantity,current_weight_grams").in("store_id", (stores ?? []).map(s => s.id)).eq("active", true).order("name").limit(500);

  return <main className="wrap section">
    <div className="eyebrow">POS</div>
    <h1>بيع سريع</h1>
    <p className="hero-copy">اختَر المحل والصنف، وأكمل العملية. عند الاعتماد يُخصم المخزون ويُنشأ القيد المحاسبي ذريًا.</p>
    <SalesForm stores={stores ?? []} products={products ?? []} />
  </main>;
}
