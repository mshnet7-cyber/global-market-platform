import Link from "next/link";
import { redirect } from "next/navigation";
import DisplayManager, { type DisplayItem } from "./DisplayManager";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { getMerchantContext } from "../../lib/merchant-access";

export default async function DisplayPage() {
  const context = await getMerchantContext();
  const admin = createSupabaseAdminClient();
  if (!context.user) redirect("/login?next=/display");
  if (!context.organization || !context.planCode || context.role === "viewer") redirect("/dashboard");
  if (!admin) redirect("/login?next=/display");

  const { data: stores } = await admin
    .from("gmp_stores")
    .select("id,name")
    .eq("organization_id", context.organization.id)
    .order("created_at");
  const storeIds = (stores ?? []).map((store) => store.id);
  const { data: screens } = storeIds.length
    ? await admin.from("gmp_screens").select("id,store_id,name,status,template").in("store_id", storeIds).order("created_at")
    : { data: [] };
  const storeMap = new Map((stores ?? []).map((store) => [store.id, store.name]));
  const displays: DisplayItem[] = (screens ?? []).map((screen) => ({ id: screen.id, name: screen.name, status: screen.status, template: screen.template, storeName: storeMap.get(screen.store_id) ?? "Store" }));

  return (
    <main className="wrap section">
      <div className="eyebrow">DIGITAL DISPLAYS</div>
      <h1>إدارة الشاشات</h1>
      <p className="hero-copy">أنشئ رمز اقتران مؤقتًا من 6 أرقام. أدخله على جهاز العرض فقط؛ لا تُحفظ كلمة مرور الحساب على الشاشة.</p>
      <DisplayManager displays={displays} />
      <section className="card" style={{ marginTop: 20 }}>
        <h2>حالة النظام</h2>
        <p className="hero-copy">غير مقترنة · بانتظار الاقتران · متصلة · غير متصلة · ملغاة · منتهية. عند انقطاع الاتصال تعرض الشاشة آخر Snapshot صالح مع وقت التحديث، ولا تسميه LIVE.</p>
        <div className="actions"><Link href="/demo" className="btn primary">فتح المعاينة</Link><Link href="/dashboard" className="btn ghost">العودة إلى لوحة التحكم</Link></div>
      </section>
    </main>
  );
}
