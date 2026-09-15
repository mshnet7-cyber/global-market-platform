import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { isValidCountry } from "../../../../lib/config";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "store";
}

function validCurrency(code: string) {
  try {
    return /^[A-Z]{3}$/.test(code) && Intl.supportedValuesOf("currency").includes(code);
  } catch {
    return /^[A-Z]{3}$/.test(code);
  }
}

function validTimezone(value: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return new NextResponse("Supabase is not configured.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const countryCode = String(form.get("country_code") ?? "").trim().toUpperCase();
  const currency = String(form.get("currency") ?? "").trim().toUpperCase();
  const submittedTimezone = String(form.get("timezone") ?? "").trim();
  if (!name || !isValidCountry(countryCode) || !validCurrency(currency)) return NextResponse.redirect(new URL("/dashboard?error=store_input", request.url));
  const timezone = validTimezone(submittedTimezone) ? submittedTimezone : "UTC";

  const { data: org } = await admin.from("gmp_organizations").select("id").eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!org) return NextResponse.redirect(new URL("/dashboard?error=organization", request.url));

  const { count: storeCount } = await admin.from("gmp_stores").select("id", { count: "exact", head: true }).eq("organization_id", org.id);
  const currentCount = storeCount ?? 0;
  const { data: subscription } = await admin.from("gmp_subscriptions").select("status,plan_id").eq("organization_id", org.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (currentCount > 0 && (!subscription || !["active", "grace_period"].includes(subscription.status))) {
    return NextResponse.redirect(new URL("/dashboard?error=subscription_required", request.url));
  }
  if (subscription && ["active", "grace_period"].includes(subscription.status)) {
    const { data: entitlement } = await admin.from("gmp_plan_entitlements").select("max_stores").eq("plan_id", subscription.plan_id).maybeSingle();
    if (entitlement?.max_stores != null && currentCount >= entitlement.max_stores) return NextResponse.redirect(new URL("/dashboard?error=store_limit", request.url));
  }

  const base = slugify(name);
  let slug = `${base}-${countryCode.toLowerCase()}`;
  for (let i = 1; i < 100; i += 1) {
    const { data: exists } = await admin.from("gmp_stores").select("id").eq("slug", slug).maybeSingle();
    if (!exists) break;
    slug = `${base}-${countryCode.toLowerCase()}-${i + 1}`;
  }

  const { data: store, error } = await admin.from("gmp_stores").insert({ organization_id: org.id, name, slug, country_code: countryCode, currency, timezone }).select("id").single();
  if (error || !store) return NextResponse.redirect(new URL("/dashboard?error=store", request.url));
  const { error: settingsError } = await admin.from("gmp_store_settings").insert({ store_id: store.id });
  if (settingsError) {
    await admin.from("gmp_stores").delete().eq("id", store.id);
    return NextResponse.redirect(new URL("/dashboard?error=settings", request.url));
  }
  return NextResponse.redirect(new URL("/dashboard?created=store", request.url));
}
