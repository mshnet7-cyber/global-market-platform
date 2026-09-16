import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import ModuleWorkspace from "./ModuleWorkspace";

const modules: Record<string, { title: string; description: string; plan: "pro" | "business" }> = {
  purchases: { title: "المشتريات", description: "إنشاء ومراجعة سجلات المشتريات والموردين.", plan: "pro" },
  expenses: { title: "المصاريف", description: "تسجيل المصروفات ومراجعة ضريبة المدخلات.", plan: "pro" },
  repairs: { title: "الإصلاحات", description: "استلام القطع ومتابعة الإصلاح والتسليم.", plan: "business" },
  "buy-gold": { title: "شراء الذهب من الأفراد", description: "توثيق بيانات البائع والهوية والوزن والسعر.", plan: "business" },
  inventory: { title: "المخزون", description: "الأصناف والكميات والأوزان والباركود.", plan: "business" },
  accounting: { title: "المحاسبة", description: "الحسابات والقيود والسجل المالي.", plan: "pro" },
  tax: { title: "الضرائب", description: "ملخصات ضريبية داخلية قابلة للمراجعة.", plan: "business" },
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
  const planRow = Array.isArray(subscription?.gmp_plans) ? subscription.gmp_plans[0] : subscription?.gmp_plans;
  const planCode = String(planRow?.code ?? "");
  const active = ["active", "trialing", "grace_period"].includes(String(subscription?.status)) && (!subscription?.current_period_end || new Date(subscription.current_period_end).getTime() >= Date.now());
  const allowed = config.plan === "pro" ? ["pro", "business"].includes(planCode) : planCode === "business";
  if (!active || !allowed) redirect("/pricing");
  return <main className="wrap section"><div className="eyebrow">MERCHANT MODULE</div><h1>{config.title}</h1><p className="hero-copy">{config.description}</p><ModuleWorkspace module={module}/></main>;
}
