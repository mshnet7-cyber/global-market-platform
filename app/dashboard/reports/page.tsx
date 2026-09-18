import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "../DashboardHeader";
import { getMerchantContext } from "../../../lib/merchant-access";

const reports = [
  ["/dashboard/sales", "تقرير المبيعات", "مراجعة عمليات البيع والفواتير ونقطة البيع."],
  ["/dashboard/purchases", "تقرير المشتريات", "مراجعة التوريد والاستلام وتكاليف الشراء."],
  ["/dashboard/inventory", "تقرير المخزون", "متابعة الأصناف والكميات والأوزان وحركة المخزون."],
  ["/dashboard/accounting", "التقرير المالي", "القيود والحسابات والحركة المالية المسجلة."],
  ["/dashboard/tax", "ملخص الضرائب", "ملخص داخلي للمبيعات وضريبة المخرجات وصافي الضريبة."],
  ["/dashboard/repairs", "تقرير الإصلاحات", "متابعة القطع المستلمة والإصلاح والتسليم."],
];

export default async function ReportsPage() {
  const { supabase, user, organization, role, planCode } = await getMerchantContext();
  if (!supabase || !user) redirect("/login?next=/dashboard/reports");
  if (!organization || !planCode || role === "viewer") redirect("/dashboard");
  return <div className="dashboard-shell">
    <DashboardHeader organizationName={organization.name} role={role} planName={planCode} />
    <main className="container dashboard-main reports-page">
      <section className="dashboard-hero">
        <div><div className="eyebrow">REPORTING</div><h1 className="dashboard-title">التقارير</h1><p className="dashboard-subtitle">مركز واحد للوصول إلى تقارير التشغيل والمال والمخزون.</p></div>
        <div className="actions"><Link href="/dashboard" className="btn ghost">العودة للوحة</Link><Link href="/dashboard/accounting" className="btn primary">التقرير المالي</Link></div>
      </section>
      <section className="grid three report-grid">{reports.map(([href,title,description]) => <Link href={href} className="card module-card" key={href}><div className="module-icon">↗</div><strong>{title}</strong><div className="meta">{description}</div><span className="module-arrow">←</span></Link>)}</section>
      <section className="card report-note"><div className="eyebrow">NOTE</div><h2>مركز التقارير الحالي</h2><p className="hero-copy">يعرض هذا القسم التقارير المتاحة داخل وحدات المنصة ويجمعها في نقطة وصول واحدة. لا يتم تقديم أي تقرير حكومي أو إرسال ضريبي من هذه الصفحة.</p></section>
    </main>
  </div>;
}
