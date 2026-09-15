import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return new NextResponse("Display management is not configured.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/display", request.url));

  const form = await request.formData();
  const storeId = String(form.get("store_id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!storeId || !name) return NextResponse.redirect(new URL("/display?error=invalid", request.url));

  const { data: store } = await admin.from("gmp_stores").select("id,organization_id").eq("id", storeId).maybeSingle();
  if (!store) return NextResponse.redirect(new URL("/display?error=store", request.url));
  const { data: org } = await admin.from("gmp_organizations").select("id").eq("id", store.organization_id).eq("owner_id", user.id).maybeSingle();
  if (!org) return NextResponse.redirect(new URL("/display?error=forbidden", request.url));

  const { data: subscription } = await admin.from("gmp_subscriptions").select("plan_id,status").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!subscription || !["active", "grace_period"].includes(subscription.status)) {
    return NextResponse.redirect(new URL("/display?error=subscription", request.url));
  }

  if (subscription.plan_id) {
    const { data: entitlement } = await admin.from("gmp_plan_entitlements").select("max_screens").eq("plan_id", subscription.plan_id).maybeSingle();
    if (entitlement?.max_screens != null) {
      const { data: stores } = await admin.from("gmp_stores").select("id").eq("organization_id", org.id);
      const storeIds = (stores ?? []).map(s => s.id);
      const { count } = storeIds.length
        ? await admin.from("gmp_screens").select("id", { count: "exact", head: true }).in("store_id", storeIds)
        : { count: 0 };
      if ((count ?? 0) >= entitlement.max_screens) return NextResponse.redirect(new URL("/display?error=screen_limit", request.url));
    }
  }

  const { data: screen, error } = await admin.from("gmp_screens").insert({ store_id: storeId, name, status: "unpaired", template: "classic" }).select("id").single();
  if (error || !screen) return NextResponse.redirect(new URL("/display?error=screen", request.url));
  return NextResponse.redirect(new URL(`/display?screen=${screen.id}&created=1`, request.url));
}
