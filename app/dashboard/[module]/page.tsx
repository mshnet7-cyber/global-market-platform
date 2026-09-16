import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const modules: Record<string, { title: string; description: string; plan: "pro" | "business"; table?: string }> = {
  purchases: { title: "المشتريات", description: "الموردون وفواتير الشراء والاستلام والمراجعة.", plan: "pro", table: "gmp_purchases" },
  expenses: { title: "المصاريف", description: "مصروفات المحل والمستندات والتصنيف.", plan: "pro", table: "gmp_expenses" },
  repairs: { title: "الإصلاحات", description: "استلام القطعة، الوزن، الصور، الموعد والتسليم.", plan: "business", table: "gmp_repair_orders" },
  "buy-gold": { title: "شراء الذهب من الأفراد", description: "توثيق الهوية والهاتف والوزن والسعر والمراجعة.", plan: "business", table: "gmp_person_gold_purchases" },
  inventory: { title: "المخزون", description: "الأصناف والباركود والوزن وحركة المخزون.", plan: "business", table: "gmp_products" },
  accounting: { title: "المحاسبة", description: "دفتر القيود والحسابات والنتائج المالية.", plan: "pro", table: "gmp_journal_entries" },
  tax: { title: "الضرائب", description: "مراجعة بيانات الضريبة وتجهيز التقارير حسب الدولة.", plan: "business" },
};

export default async function MerchantModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const config = modules[module];
  if (!config) notFound();
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`/login?next=/dashboard/${module}`);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/dashboard/${module}`);
  const { data: organization } = await supabase.from("gmp_organizations").select("id").eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!organization) redirect("/signup?error=account_setup");
  const { data: subscription } = await supabase.from("gmp_subscriptions").select("status,current_period_end,gmp_plans(code,name)").eq("organization_id", organization.id).maybeSingle();
  const planRow = Array.isArray(subscription?.gmp_plans) ? subscription?.gmp_plans[0] : subscription?.gmp_plans;
  const planCode = String(planRow?.code ?? "");
  const active = ["active", "trialing", "grace_period"].includes(String(subscription?.status)) && (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() >= Date.now());
  const allowed = config.plan === "pro" ? ["pro", "business"].includes(planCode) : planCode === "business";
  if (!active || !allowed) redirect("/pricing");

  let count = 0;
  if (config.table) {
    const { count: rowCount } = await supabase.from(config.table).select("id", { count: "exact", head: true }).eq("organization_id", organization.id);
    count = rowCount ?? 0;
  }

  return <main className="wrap section">
    <div className="eyebrow">MERCHANT MODULE</div>
    <h1>{config.title}</h1>
    <p className="hero-copy">{config.description}</p>
    <section className="grid three" style={{marginTop:24}}>
      <div className="card"><div className="card-title">الحساب</div><div className="metric">{planRow?.name ?? "—"}</div><div className="meta">الباقة الحالية</div></div>
      <div className="card"><div className="card-title">السجلات</div><div className="metric">{count}</div><div className="meta">ضمن المؤسسة الحالية</div></div>
      <div className="card"><div className="card-title">العمل</div><div className="metric">جاهز</div><div className="meta">العمليات الحساسة تحتاج اعتمادًا</div></div>
    </section>
    <section className="card" style={{marginTop:20}}>
      <strong>حالة الوحدة</strong>
      <p className="hero-copy" style={{marginTop:8}}>هذه مساحة التشغيل الأساسية للوحدة. سيتم تنفيذ الإدخالات والاعتمادات من واجهات متخصصة مرتبطة بنفس البيانات المركزية وسجل التدقيق.</p>
      <div className="actions" style={{marginTop:16}}><Link href="/dashboard" className="btn primary">لوحة المحل</Link>{module !== "accounting" && <Link href="/dashboard/sales" className="btn">بيع سريع</Link>}</div>
    </section>
  </main>;
}
