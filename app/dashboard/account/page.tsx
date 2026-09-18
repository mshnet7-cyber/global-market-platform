import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import DashboardHeader from "../DashboardHeader";
import Link from "next/link";

export default async function AccountPage() {
  const { supabase, user, organization, role, planCode } = await getMerchantContext();
  if (!supabase || !user) redirect("/login?next=/dashboard/account");
  if (!organization || !role) redirect("/signup?error=account_setup");
  return (
    <div className="dashboard-shell">
      <DashboardHeader organizationName={organization.name} role={role} planName={planCode || "لا توجد خطة فعالة"} />
      <main className="wrap section dashboard-module-page">
        <div className="eyebrow">ACCOUNT / SETTINGS</div>
        <h1>الحساب والإعدادات</h1>
        <p className="hero-copy">معلومات الحساب الحالية، المؤسسة، الصلاحية، والاختصارات التشغيلية. لا توجد هنا إعدادات وهمية غير مدعومة من Backend.</p>
        <section className="grid two">
          <article className="card">
            <div className="card-title">حساب المستخدم</div>
            <div className="stage3-kv" style={{marginTop:12}}>
              <div><span>البريد الإلكتروني</span><b>{user.email || "—"}</b></div>
              <div><span>المعرّف</span><b>{user.id}</b></div>
              <div><span>الصلاحية</span><b>{role === "owner" ? "مالك" : role === "admin" ? "مدير" : "مشاهد"}</b></div>
            </div>
          </article>
          <article className="card">
            <div className="card-title">المؤسسة</div>
            <div className="stage3-kv" style={{marginTop:12}}>
              <div><span>الاسم</span><b>{organization.name}</b></div>
              <div><span>الخطة</span><b>{planCode || "لا توجد خطة فعالة"}</b></div>
            </div>
          </article>
        </section>
        <section className="card" style={{marginTop:16}}>
          <div className="card-title">الاختصارات</div>
          <div className="actions" style={{marginTop:12}}>
            <Link className="btn primary" href="/dashboard/integrations">التكاملات والاشتراكات</Link>
            <Link className="btn" href="/dashboard/api-keys">مفاتيح API</Link>
            <Link className="btn" href="/dashboard">لوحة التشغيل</Link>
            <Link className="btn" href="/">الرئيسية</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
