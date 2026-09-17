import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import CameraWorkspace from "./CameraWorkspace";
import DashboardHeader from "../DashboardHeader";

export default async function CamerasPage() {
  const { supabase, user, organization, role, planCode } = await getMerchantContext();
  if (!supabase || !user) redirect("/login?next=/dashboard/cameras");
  if (!organization || !planCode || planCode !== "business") redirect("/pricing");
  if (role === "viewer") redirect("/dashboard");
  const { data: stores } = await supabase.from("gmp_stores").select("id,name,branch_id,country_code").eq("organization_id", organization.id).order("name");
  const { data: branches } = await supabase.from("gmp_branches").select("id,name").eq("organization_id", organization.id).eq("active", true).order("name");
  return <div className="dashboard-shell">
    <DashboardHeader organizationName={organization.name} role={role} planName="الكاملة" />
    <main className="wrap section dashboard-module-page cameras-page">
      <div className="eyebrow">BUSINESS / CAMERAS</div>
      <h1>الكاميرات والمراقبة</h1>
      <p className="hero-copy">إدارة الكاميرات داخل المنصة. روابط البث تُقبل بدون بيانات دخول داخل الرابط؛ كلمات المرور تُحفظ فقط عبر مرجع سري.</p>
      <div className="module-context"><span>صلاحية: {role === "owner" ? "مالك" : "مدير"}</span><span>الخطة الكاملة</span><span>مراجع سرية للبيانات الحساسة</span></div>
      <CameraWorkspace stores={stores ?? []} branches={branches ?? []} />
    </main>
  </div>;
}
