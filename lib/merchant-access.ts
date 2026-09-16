import { createSupabaseServerClient } from "./supabase/server";

export type MerchantPlanCode = "starter" | "pro" | "business";
export type MerchantRole = "owner" | "admin" | "viewer";

export async function getMerchantContext() {
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
    .select("status,current_period_end,plan_id,gmp_plans(code)")
    .eq("organization_id", organization.id)
    .maybeSingle();
  const planRelation = Array.isArray(subscription?.gmp_plans) ? subscription?.gmp_plans[0] : subscription?.gmp_plans;
  const planCode = planRelation?.code as MerchantPlanCode | undefined;
  const active = subscription?.status === "active" || subscription?.status === "trialing" || subscription?.status === "grace_period";
  const notExpired = !subscription?.current_period_end || new Date(subscription.current_period_end).getTime() >= Date.now();

  return { supabase, user, organization, role, planCode: active && notExpired ? (planCode ?? null) : null };
}

export async function requireMerchantPlan(allowed: MerchantPlanCode[]) {
  const context = await getMerchantContext();
  if (!context.user || !context.organization || !context.planCode || !allowed.includes(context.planCode) || context.role === "viewer") {
    throw new Error("merchant_plan_required");
  }
  return context as typeof context & { user: NonNullable<typeof context.user>; organization: NonNullable<typeof context.organization>; role: "owner" | "admin"; planCode: MerchantPlanCode };
}
