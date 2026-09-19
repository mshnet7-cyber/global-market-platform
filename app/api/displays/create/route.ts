import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getMerchantContext } from "../../../../lib/merchant-access";
import { requestContentLengthExceeds } from "../../../../lib/bounded-body";

function subscriptionIsUsable(subscription: { status: string; current_period_end: string | null } | null) {
  if (!subscription || !["active", "trialing", "grace_period"].includes(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export async function POST(request: Request) {
  const context = await getMerchantContext();
  const admin = createSupabaseAdminClient();
  if (!context.user) return NextResponse.redirect(new URL("/login?next=/display", request.url));
  if (!context.organization || !context.planCode || context.role === "viewer") {
    return NextResponse.redirect(new URL("/display?error=forbidden", request.url));
  }
  if (!admin) return new NextResponse("Display management is not configured.", { status: 503 });

  if (requestContentLengthExceeds(request, 64 * 1024)) return new NextResponse("Request body too large.", { status: 413 });

  const form = await request.formData();
  const storeId = String(form.get("store_id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!storeId || !name) return NextResponse.redirect(new URL("/display?error=invalid", request.url));

  const { data: store } = await admin.from("gmp_stores").select("id,organization_id").eq("id", storeId).eq("organization_id", context.organization.id).maybeSingle();
  if (!store) return NextResponse.redirect(new URL("/display?error=forbidden", request.url));

  const { data: subscription } = await admin
    .from("gmp_subscriptions")
    .select("plan_id,status,current_period_end")
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscriptionIsUsable(subscription)) return NextResponse.redirect(new URL("/display?error=subscription", request.url));

  if (subscription?.plan_id) {
    const { data: entitlement } = await admin.from("gmp_plan_entitlements").select("max_screens").eq("plan_id", subscription.plan_id).maybeSingle();
    if (entitlement?.max_screens != null) {
      const { data: stores } = await admin.from("gmp_stores").select("id").eq("organization_id", context.organization.id);
      const storeIds = (stores ?? []).map((item) => item.id);
      const { count } = storeIds.length
        ? await admin.from("gmp_screens").select("id", { count: "exact", head: true }).in("store_id", storeIds)
        : { count: 0 };
      if ((count ?? 0) >= entitlement.max_screens) return NextResponse.redirect(new URL("/display?error=screen_limit", request.url));
    }
  }

  const { data: screen, error } = await admin
    .from("gmp_screens")
    .insert({ store_id: storeId, name, status: "unpaired", template: "classic" })
    .select("id")
    .single();
  if (error || !screen) return NextResponse.redirect(new URL("/display?error=screen", request.url));
  return NextResponse.redirect(new URL(`/display?screen=${screen.id}&created=1`, request.url));
}
