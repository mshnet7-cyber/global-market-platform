import { redirect, notFound } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import ModuleWorkspace from "./ModuleWorkspace";

type StoreOption = { id: string; name: string; branch_id: string | null; currency: string | null; timezone: string | null };

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
  const { supabase, user, organization, role, planCode } = context;
  if (!supabase || !user) redirect(`/login?next=/dashboard/${module}`);
  if (!organization || !planCode) redirect("/pricing");
  if (role === "viewer") redirect("/dashboard");

  const allowed = config.plan === "pro" ? ["pro", "business"].includes(planCode) : planCode === "business";
  if (!allowed) redirect("/pricing");

  const { data: storeRows } = await supabase
    .from("gmp_stores")
    .select("id,name,branch_id,currency,timezone")
    .eq("organization_id", organization.id)
    .order("name");
  const stores: StoreOption[] = (storeRows ?? []).map((store) => ({
    id: String(store.id),
    name: String(store.name),
    branch_id: store.branch_id ? String(store.branch_id) : null,
    currency: store.currency ? String(store.currency) : null,
    timezone: store.timezone ? String(store.timezone) : null,
  }));

  return <div className={`dashboard-shell dashboard-module-page module-${module}`}><main className="wrap section"><div className="eyebrow">MERCHANT MODULE</div><h1>{config.title}</h1><p className="hero-copy">{config.description}</p><ModuleWorkspace module={module} stores={stores}/></main></div>;
}
