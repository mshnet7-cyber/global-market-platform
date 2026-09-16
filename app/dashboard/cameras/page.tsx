import { redirect } from "next/navigation";
import Link from "next/link";
import { getMerchantContext } from "../../../lib/merchant-access";
import CameraWorkspace from "./CameraWorkspace";

export default async function CamerasPage() {
  const { supabase, user, organization, role, planCode } = await getMerchantContext();
  if (!supabase || !user) redirect("/login?next=/dashboard/cameras");
  if (!organization || !planCode || planCode !== "business") redirect("/pricing");
  if (role === "viewer") redirect("/dashboard");
  const { data: stores } = await supabase.from("gmp_stores").select("id,name,branch_id,country_code").eq("organization_id", organization.id).order("name");
  const { data: branches } = await supabase.from("gmp_branches").select("id,name").eq("organization_id", organization.id).eq("active", true).order("name");
  return <main className="wrap section">
    <div className="actions" style={{marginBottom:20}}><Link href="/dashboard" className="btn">لوحة المحل</Link><Link href="/dashboard/compliance" className="btn">الامتثال</Link><Link href="/dashboard/invoicing" className="btn">الفوترة حسب الدولة</Link></div>
    <div className="eyebrow">BUSINESS / CAMERAS</div>
    <h1>الكاميرات والمراقبة</h1>
    <p className="hero-copy">إدارة الكاميرات داخل المنصة. روابط البث تُقبل بدون بيانات دخول داخل الرابط؛ كلمات المرور تُحفظ فقط عبر مرجع سري.</p>
    <CameraWorkspace stores={stores ?? []} branches={branches ?? []} />
  </main>;
}
