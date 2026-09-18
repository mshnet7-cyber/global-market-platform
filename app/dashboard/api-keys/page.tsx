import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import DashboardHeader from "../DashboardHeader";
import ApiKeysWorkspace from "./ApiKeysWorkspace";
import WebhooksWorkspace from "./WebhooksWorkspace";

export default async function ApiKeysPage() {
  const { supabase, user, organization, role, planCode } = await getMerchantContext();
  if (!supabase || !user) redirect("/login?next=/dashboard/api-keys");
  if (!organization || !planCode || !["pro", "business"].includes(planCode) || role === "viewer") redirect("/pricing");

  const { data } = await supabase
    .from("gmp_api_keys")
    .select("id,name,key_prefix,scopes,last_used_at,revoked_at,created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  return (
    <div className="dashboard-shell">
      <DashboardHeader organizationName={organization.name} role={role} planName={planCode === "business" ? "الكاملة" : "الأعمال"} />
      <main className="wrap section dashboard-module-page">
        <div className="eyebrow">DEVELOPER PLATFORM</div>
        <h1>مفاتيح API</h1>
        <p className="hero-copy">أنشئ مفاتيح للوصول إلى API v1/v2. المفتاح الخام يظهر مرة واحدة فقط؛ النظام يحتفظ بالـhash.</p>
        <div className="module-context"><span>الخطة: {planCode}</span><span>صلاحية: {role === "owner" ? "مالك" : "مدير"}</span><span>Rate limit: 120/min</span></div>
        <ApiKeysWorkspace initialKeys={data ?? []} />
        <div style={{ marginTop: 18 }}><WebhooksWorkspace /></div>
      </main>
    </div>
  );
}
