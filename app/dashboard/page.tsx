import { redirect } from "next/navigation";
import Link from "next/link";
import { getMerchantContext } from "../../lib/merchant-access";
import { countries, appConfig } from "../../lib/config";

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

  return <main className="wrap section">
    <div className="eyebrow">MERCHANT</div>
    <h1>لوحة المحل</h1>
    <p className="hero-copy">مرحبًا {user.email}. إدارة المحل والفروع والشاشات والخدمات من مكان واحد.</p>

    <section className="grid four" style={{marginTop:24}}>{modules.map(([href,title,description]) => <Link href={href} className="card" key={href}><strong>{title}</strong><div className="meta" style={{marginTop:8}}>{description}</div></Link>)}</section>

    <section className="card" style={{marginTop:24}}>
      <div className="card-top"><strong>المؤسسة</strong><span className="status">{organization.name}</span></div>
      <div className="notice" style={{marginTop:14}}>{organization.slug} · صلاحية {role === "owner" ? "مالك" : role === "admin" ? "مدير" : "مشاهد"}</div>
    </section>

    <section className="card" style={{marginTop:20}}>
      <div className="card-top"><strong>الاشتراك</strong><span className="status">{currentPlan?.name ?? "غير محدد"}</span></div>
      <div className="grid three" style={{marginTop:16}}>{plans.map((plan) => <div className="notice" key={plan.code}><strong>{plan.name}</strong><br />{plan.monthly} ر.ع / شهر<br />{plan.sixMonth} ر.ع / 6 أشهر<br />{plan.yearly} ر.ع / سنة<br /><span className="muted">خصم الفرع الإضافي: {plan.discount}</span></div>)}</div>
      <div className="notice" style={{marginTop:14}}>الشاشة الإضافية: 4 ر.ع شهريًا · 21 ر.ع لـ6 أشهر · 44 ر.ع سنويًا.</div>
      {subscription?.current_period_end && <div className="muted" style={{marginTop:10}}>انتهاء الفترة الحالية: {new Date(subscription.current_period_end).toLocaleDateString("ar-OM")}</div>}
    </section>

    <section className="card" style={{marginTop:20}}>
      <div className="card-top"><strong>المتاجر والفروع</strong><span className="status">{stores?.length ?? 0}</span></div>
      {stores?.length ? <div className="grid" style={{marginTop:16}}>{stores.map((store) => <Link href={`/store/${store.slug}`} className="notice" key={store.id}><strong>{store.name}</strong><br /><span>{store.country_code} · {store.currency} · {store.timezone}</span></Link>)}</div> : <div className="notice" style={{marginTop:16}}>لم يتم إنشاء متجر بعد.</div>}
      {role !== "viewer" && <form action="/api/stores/create" method="post" className="grid two-col" style={{marginTop:16}}>
        <label className="label">اسم المتجر<input className="select" name="name" placeholder="اسم المتجر" minLength={2} maxLength={120} required /></label>
        <label className="label">الدولة<select className="select" name="country_code" defaultValue={appConfig.defaultCountry}>{countries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label>
        <label className="label">العملة<input className="select" name="currency" defaultValue={appConfig.defaultCurrency} maxLength={3} required /></label>
        <label className="label">المنطقة الزمنية<input className="select" name="timezone" defaultValue="Asia/Muscat" required /></label>
        <div className="actions" style={{alignItems:"end"}}><button className="btn primary" type="submit">إنشاء متجر</button></div>
      </form>}
    </section>

    <div className="actions" style={{marginTop:24}}><Link href="/display" className="btn primary">إدارة الشاشات</Link><Link href="/pricing" className="btn ghost">الباقات</Link><Link href="/" className="btn ghost">الواجهة العامة</Link></div>
  </main>;
}
