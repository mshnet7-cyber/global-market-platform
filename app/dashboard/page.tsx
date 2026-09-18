import { redirect } from "next/navigation";
import Link from "next/link";
import { getMerchantContext } from "../../lib/merchant-access";
import { countries, appConfig } from "../../lib/config";
import DashboardHeader from "./DashboardHeader";
import { formatMoneyDisplay } from "../../lib/currency-display";

const plans = [
  { code: "starter", name: "الشاشة", monthly: 5, sixMonth: 25, yearly: 50, discount: "2.5%" },
  { code: "pro", name: "الأعمال", monthly: 25, sixMonth: 125, yearly: 240, discount: "5%" },
  { code: "business", name: "الكاملة", monthly: 46, sixMonth: 247, yearly: 450, discount: "8%" },
];

const modules = [
  ["/dashboard/sales", "المبيعات وPOS", "بيع سريع، فواتير، دفع، وجرد تلقائي"],
  ["/dashboard/purchases", "المشتريات", "موردون وفواتير واستلام وتدقيق"],
  ["/dashboard/expenses", "المصاريف", "مصروفات المحل والصندوق والتقارير"],
  ["/dashboard/repairs", "الإصلاحات", "استلام القطعة، الوزن، الصور، التسليم"],
  ["/dashboard/buy-gold", "شراء الذهب من الأفراد", "هوية، هاتف، وزن، مراجعة، سجل العملية"],
  ["/dashboard/inventory", "المخزون", "الأصناف والباركود والجرد وحركة القطعة"],
  ["/dashboard/accounting", "المحاسبة", "قيود، أرباح وخسائر، صندوق، بنك"],
  ["/dashboard/tax", "الضرائب", "تقارير الضريبة وبيانات الإقرار"],
] as const;

const quickLinks = [
  ["/dashboard/integrations", "التكاملات", "AI/OCR، WhatsApp، الاشتراكات وطبقات التكامل", "I"],
  ["/dashboard/api-keys", "مفاتيح API", "إدارة مفاتيح المطورين والربط البرمجي", "A"],
  ["/dashboard/invoicing", "الفوترة", "إعدادات الفوترة الإلكترونية", "T"],
  ["/display", "الشاشات", "الاقتران وإدارة الشاشات الرقمية", "D"],
  ["/dashboard/cameras", "الكاميرات", "إدارة أجهزة المراقبة", "C"],
  ["/dashboard/compliance", "الامتثال", "الحالات وسجل الأحداث", "✓"],
] as const;

export default async function DashboardPage() {
  const context = await getMerchantContext();
  const { supabase, user, organization, role, planCode } = context;
  if (!supabase) redirect("/login?next=/dashboard");
  if (!user) redirect("/login?next=/dashboard");
  if (!organization || !role) redirect("/signup?error=account_setup");

  const { data: stores } = await supabase.from("gmp_stores").select("id,name,slug,country_code,currency,timezone,branch_id,created_at").eq("organization_id", organization.id).order("created_at", { ascending: true });
  const { data: subscription } = await supabase.from("gmp_subscriptions").select("status,current_period_end,plan_id,gmp_plans(code,name)").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const planRelation = Array.isArray(subscription?.gmp_plans) ? subscription?.gmp_plans[0] : subscription?.gmp_plans;
  const currentPlan = plans.find((plan) => plan.code === (planRelation?.code ?? planCode));
  const business = planCode === "business";

  return <div className="dashboard-shell">
    <DashboardHeader organizationName={organization.name} role={role} planName={currentPlan?.name} />

    <main className="container dashboard-main">
      <section className="dashboard-hero"><div><div className="eyebrow">MERCHANT WORKSPACE</div><h1 className="dashboard-title">لوحة المحل</h1><p className="dashboard-subtitle">كل عمليات المحل مرتبة في مساحة تشغيل واحدة، مع وصول سريع للمهام اليومية.</p></div><div className="actions"><Link href="/dashboard/sales" className="btn primary">فتح نقطة البيع</Link><Link href="/display" className="btn ghost">إدارة الشاشات</Link></div></section>
      <section className="dashboard-kpis"><div className="kpi"><div className="kpi-label">الخطة الحالية</div><div className="kpi-value">{currentPlan?.name ?? "—"}</div></div><div className="kpi"><div className="kpi-label">المتاجر والفروع</div><div className="kpi-value">{stores?.length ?? 0}</div></div><div className="kpi"><div className="kpi-label">حالة الاشتراك</div><div className="kpi-value">{subscription?.status ?? "—"}</div></div><div className="kpi"><div className="kpi-label">صلاحية الحساب</div><div className="kpi-value">{role === "owner" ? "مالك" : role === "admin" ? "مدير" : "مشاهد"}</div></div></section>
      <section className="section"><div className="section-head"><div><div className="eyebrow">WORKSPACE</div><h2>الوحدات الأساسية</h2></div><span className="meta">اختر العملية التي تريد تنفيذها</span></div><div className="grid grid-4">{modules.map(([href,title,description], index) => <Link href={href} className="card module-card" key={href}><div className="module-icon">{String(index + 1).padStart(2, "0")}</div><strong>{title}</strong><div className="meta">{description}</div><span className="module-arrow">←</span></Link>)}</div></section>
      <section className="section"><div className="section-head"><div><div className="eyebrow">CONTROL CENTER</div><h2>الخدمات والإدارة</h2></div></div><div className="grid four">{quickLinks.map(([href,title,description,icon]) => <Link href={href === "/dashboard/api-keys" && !["pro","business"].includes(planCode || "") ? "/pricing" : (["/dashboard/invoicing","/dashboard/cameras","/dashboard/compliance"].includes(href) && !business ? "/pricing" : href)} className="card module-card" key={href}><div className="module-icon">{icon}</div><strong>{title}</strong><div className="meta">{((href === "/dashboard/api-keys" && !["pro","business"].includes(planCode || "")) || (["/dashboard/invoicing","/dashboard/cameras","/dashboard/compliance"].includes(href) && !business)) ? "متاح بحسب الباقة والصلاحيات." : description}</div><span className="module-arrow">←</span></Link>)}</div></section>
      <section className="card subscription-panel"><div className="section-head"><div><div className="eyebrow">SUBSCRIPTION</div><h2>اشتراكك الحالي</h2></div><span className="status">{currentPlan?.name ?? "غير محدد"}</span></div><div className="plan-strip"><div className="plan-tile highlight"><div className="meta">الباقة الحالية</div><div className="plan-price">{currentPlan?.name ?? "—"}</div><div className="meta">{subscription?.current_period_end ? `تنتهي ${new Date(subscription.current_period_end).toLocaleDateString("ar-OM")}` : "لا يوجد تاريخ انتهاء مسجل"}</div></div>{plans.map((plan) => <div className="plan-tile" key={plan.code}><div className="meta">{plan.name}</div><div className="plan-price">{formatMoneyDisplay(plan.monthly, "OMR", "ar-OM", 0)}</div><div className="meta">شهريًا · خصم الفروع {plan.discount}</div></div>)}</div><div className="actions" style={{marginTop:16}}><Link href="/pricing" className="btn primary">عرض الباقات</Link><span className="meta">الشاشة الإضافية: ⃄ 4 شهريًا · ⃄ 21 لـ6 أشهر · ⃄ 44 سنويًا.</span></div></section>
      <section className="section"><div className="section-head"><div><div className="eyebrow">STORES</div><h2>المتاجر والفروع</h2></div><span className="status">{stores?.length ?? 0}</span></div>{stores?.length ? <div className="grid three">{stores.map((store) => <Link href={`/store/${store.slug}`} className="card" key={store.id}><div className="card-top"><strong>{store.name}</strong><span className="status">{store.country_code}</span></div><div className="meta store-meta">{store.currency} · {store.timezone}</div></Link>)}</div> : <div className="empty-state">لم يتم إنشاء متجر بعد. أضف أول متجر من النموذج أدناه.</div>}{role !== "viewer" && <form action="/api/stores/create" method="post" className="card two-col create-store-form"><label className="label">اسم المتجر<input className="select" name="name" placeholder="اسم المتجر" minLength={2} maxLength={120} required /></label><label className="label">الدولة<select className="select" name="country_code" defaultValue={appConfig.defaultCountry}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label><label className="label">العملة<input className="select" name="currency" defaultValue={appConfig.defaultCurrency} maxLength={3} required /></label><label className="label">المنطقة الزمنية<input className="select" name="timezone" defaultValue="Asia/Muscat" required /></label><div className="actions form-actions"><button className="btn primary" type="submit">إنشاء متجر</button></div></form>}</section>
    </main>
  </div>;
}
