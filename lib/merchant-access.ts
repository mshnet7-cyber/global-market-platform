import { createSupabaseServerClient } from "./supabase/server";
import { createSupabaseAdminClient } from "./supabase/admin";
import { getDemoSession } from "./demo-auth";

import { isMerchantPlanCode, type MerchantPlanCode } from "./saas-plans";

export type { MerchantPlanCode };
export type MerchantRole = "owner" | "admin" | "viewer";
export type MerchantEntitlement = "analytics" | "alerts" | "members" | "ai_ocr" | "accounting" | "pos" | "inventory" | "repairs" | "person_gold_purchase" | "tax_reports" | "advanced_audit" | "advanced_reports";

export async function getMerchantContext() {
  const demo = await getDemoSession();
  if (demo) {
    if (demo.role !== "shop_owner") return { supabase: null, user: null, organization: null, role: null as MerchantRole | null, planCode: null as MerchantPlanCode | null };

    const supabase = createSupabaseAdminClient({ "x-gmp-demo-role": "shop_owner" });
    if (!supabase) return { supabase: null, user: null, organization: null, role: null as MerchantRole | null, planCode: null as MerchantPlanCode | null };

    const { data: organization } = await supabase
      .from("gmp_organizations")
      .select("id,name,slug,owner_id")
      .eq("slug","global-market-demo-shop")
      .maybeSingle();

    if (!organization) return { supabase, user: null, organization: null, role: null, planCode: null };

    const { data: subscription } = await supabase
      .from("gmp_subscriptions")
      .select("status,current_period_end,plan_id,gmp_plans(code),created_at")
      .eq("organization_id", organization.id)
      .order("created_at",{ ascending:false })
      .limit(1)
      .maybeSingle();

    const relation = Array.isArray(subscription?.gmp_plans) ? subscription?.gmp_plans[0] : subscription?.gmp_plans;
    const active = subscription?.status === "active" || subscription?.status === "trialing" || subscription?.status === "grace_period";
    const notExpired = !subscription?.current_period_end || new Date(subscription.current_period_end).getTime() >= Date.now();

    return {
      supabase,
      user: { id: demo.account.userId, email: demo.account.email },
      organization,
      role: "owner" as const,
      planCode: active && notExpired && isMerchantPlanCode(relation?.code) ? relation.code : null
    };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { supabase: null, user: null, organization: null, role: null as MerchantRole | null, planCode: null as MerchantPlanCode | null };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, organization: null, role: null, planCode: null };

  const { data: owned } = await supabase
    .from("gmp_organizations")
    .select("id,name,slug,owner_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let organization = owned;
  let role: MerchantRole | null = owned ? "owner" : null;

  if (!organization) {
    const { data: membership } = await supabase
      .from("gmp_organization_members")
      .select("organization_id,role,gmp_organizations(id,name,slug,owner_id)")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin", "viewer"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const relation = Array.isArray(membership?.gmp_organizations) ? membership?.gmp_organizations[0] : membership?.gmp_organizations;
    organization = relation ?? null;
    role = membership?.role as MerchantRole | null;
  }

  if (!organization || !role) return { supabase, user, organization: null, role: null, planCode: null };

  const { data: subscription } = await supabase
    .from("gmp_subscriptions")
    .select("status,current_period_end,plan_id,gmp_plans(code),created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const planRelation = Array.isArray(subscription?.gmp_plans) ? subscription?.gmp_plans[0] : subscription?.gmp_plans;
  const planCode = isMerchantPlanCode(planRelation?.code) ? planRelation.code : null;
  const active = subscription?.status === "active" || subscription?.status === "trialing" || subscription?.status === "grace_period";
  const notExpired = !subscription?.current_period_end || new Date(subscription.current_period_end).getTime() >= Date.now();

  const effectivePlanCode = active && notExpired ? (planCode ?? null) : null;
  const { data: entitlement } = effectivePlanCode
    ? await supabase.from("gmp_plan_entitlements").select("analytics,alerts,members,ai_ocr,accounting,pos,inventory,repairs,person_gold_purchase,tax_reports,advanced_audit,advanced_reports").eq("plan_id", subscription?.plan_id ?? "").maybeSingle()
    : { data: null };
  return { supabase, user, organization, role, planCode: effectivePlanCode, entitlements: entitlement ?? null };
}

export async function requireMerchantPlan(allowed: MerchantPlanCode[]) {
  const context = await getMerchantContext();
  if (!context.user || !context.organization || !context.planCode || !allowed.includes(context.planCode) || context.role === "viewer") {
    throw new Error("merchant_plan_required");
  }
  return context as typeof context & { user: NonNullable<typeof context.user>; organization: NonNullable<typeof context.organization>; role: "owner" | "admin"; planCode: MerchantPlanCode };
}


export async function requireMerchantEntitlement(entitlement: MerchantEntitlement) {
  const context = await requireMerchantPlan(["starter","pro","business"]);
  if (!context.entitlements || context.entitlements[entitlement] !== true) throw new Error("merchant_entitlement_required");
  return context;
}
