import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import SalesForm from "./SalesForm";

export default async function SalesPage() {
  const context = await getMerchantContext();
  const { supabase, user, organization, planCode, role } = context;
  if (!supabase) redirect("/login?next=/dashboard/sales");
  if (!user) redirect("/login?next=/dashboard/sales");
  if (!organization || !planCode || role === "viewer" || !["pro", "business"].includes(planCode)) redirect("/pricing");

  const { data: stores } = await supabase.from("gmp_stores").select("id,name,branch_id,currency").eq("organization_id", organization.id).order("created_at", { ascending: true });
  const storeIds = (stores ?? []).map((store) => store.id);
  const { data: products } = storeIds.length
    ? await supabase.from("gmp_products").select("id,name,sku,barcode,karat,weight_grams,price,making_charge,currency,current_quantity,current_weight_grams,store_id").in("store_id", storeIds).eq("active", true).order("name").limit(500)
    : { data: [] };

  return <main className="wrap section">
    <div className="eyebrow">POS</div>
    <h1>بيع سريع</h1>
    <p className="hero-copy">اختَر المحل والصنف، وأكمل العملية. عند الاعتماد يُخصم المخزون ويُنشأ القيد المحاسبي ذريًا.</p>
    <SalesForm stores={stores ?? []} products={products ?? []} />
  </main>;
}
