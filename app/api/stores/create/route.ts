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

  const { data, error } = await admin.rpc("gmp_create_store", {
    p_org_id: org.id,
    p_name: name,
    p_country_code: countryCode,
    p_currency: currency,
    p_timezone: timezone,
    p_base_slug: slugify(name),
  });

  if (error || !data?.store_id) {
    const message = String(error?.message ?? "");
    if (message.includes("subscription_required")) return NextResponse.redirect(new URL("/dashboard?error=subscription_required", request.url));
    if (message.includes("store_limit")) return NextResponse.redirect(new URL("/dashboard?error=store_limit", request.url));
    if (message.includes("slug_generation_failed")) return NextResponse.redirect(new URL("/dashboard?error=store_slug", request.url));
    return NextResponse.redirect(new URL("/dashboard?error=store", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard?created=store", request.url));
}
