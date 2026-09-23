import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import SalesForm from "./SalesForm";
import DashboardHeader from "../DashboardHeader";

export default async function SalesPage() {
  const context = await getMerchantContext();
  const { supabase, user, organization, planCode, role } = context;
  if (!supabase) redirect("/login?next=/dashboard/sales");
  if (!user) redirect("/login?next=/dashboard/sales");
  if (!organization || !planCode || role === "viewer" || !["pro", "business"].includes(planCode)) redirect("/pricing");

  const { data: stores } = await supabase.from("gmp_stores").select("id,name,branch_id,currency").eq("organization_id", organization.id).order("created_at", { ascending: true });
  const storeIds = (stores ?? []).map((store) => store.id);
  const { data: customers } = await supabase.from("gmp_customers").select("id,name,phone").eq("organization_id", organization.id).order("name").limit(500);
  const { data: recentSales } = await supabase.from("gmp_sales").select("id,invoice_no,customer_id,total,status,payment_method,issued_at,created_at").eq("organization_id", organization.id).order("created_at",{ascending:false}).limit(30);
  const { data: products } = storeIds.length
    ? await supabase.from("gmp_products").select("id,name,sku,barcode,karat,weight_grams,price,making_charge,currency,current_quantity,current_weight_grams,store_id").in("store_id", storeIds).eq("active", true).order("name").limit(500)
    : { data: [] };

  return <div className="dashboard-shell">
    <DashboardHeader organizationName={organization.name} role={role} planName={planCode === "business" ? "الكاملة" : "الأعمال"} />
    <main className="wrap section dashboard-module-page pos-page">
      <div className="eyebrow">نقطة البيع · المبيعات</div>
      <h1>بيع سريع</h1>
      <p className="hero-copy">اختَر المحل والصنف، وأكمل العملية. عند الاعتماد يُخصم المخزون ويُنشأ القيد المحاسبي ذريًا.</p>
      <div className="module-context"><span>{stores?.length ?? 0} متجر</span><span>{products?.length ?? 0} صنف نشط</span><span>الترحيل الذري مفعّل</span></div>
      <SalesForm stores={stores ?? []} products={products ?? []} customers={customers ?? []} recentSales={recentSales ?? []} />
    </main>
  </div>;
}
