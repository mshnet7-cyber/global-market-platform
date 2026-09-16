import { redirect, notFound } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
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

  const context = await getMerchantContext();
  const { supabase, user, organization, planCode } = context;
  if (!supabase) redirect(`/login?next=/dashboard/${module}`);
  if (!user) redirect(`/login?next=/dashboard/${module}`);
  if (!organization || !planCode) redirect("/pricing");

  const allowed = config.plan === "pro" ? ["pro", "business"].includes(planCode) : planCode === "business";
  if (!allowed) redirect("/pricing");

  return <main className="wrap section"><div className="eyebrow">MERCHANT MODULE</div><h1>{config.title}</h1><p className="hero-copy">{config.description}</p><ModuleWorkspace module={module}/></main>;
}
