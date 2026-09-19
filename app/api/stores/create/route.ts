import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getMerchantContext } from "../../../../lib/merchant-access";
import { isValidCountry } from "../../../../lib/config";
import { readBoundedRequestFormData } from "../../../../lib/bounded-body";

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

  const context = await getMerchantContext();
  const { user, organization, role } = context;
  if (!user) return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));
  if (!organization || !role || role === "viewer") return NextResponse.redirect(new URL("/dashboard?error=forbidden", request.url));

  let form: FormData;
  try { form = await readBoundedRequestFormData(request, 64 * 1024); }
  catch (error) { return new NextResponse(error instanceof Error && error.message === "request_body_too_large" ? "Request body too large." : "Invalid request body.", { status: error instanceof Error && error.message === "request_body_too_large" ? 413 : 400 }); }


  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const countryCode = String(form.get("country_code") ?? "").trim().toUpperCase();
  const currency = String(form.get("currency") ?? "").trim().toUpperCase();
  const submittedTimezone = String(form.get("timezone") ?? "").trim();
  if (!name || !isValidCountry(countryCode) || !validCurrency(currency) || !validTimezone(submittedTimezone)) {
    return NextResponse.redirect(new URL("/dashboard?error=store_input", request.url));
  }

  const { data, error } = await admin.rpc("gmp_create_store", {
    p_org_id: organization.id,
    p_name: name,
    p_country_code: countryCode,
    p_currency: currency,
    p_timezone: submittedTimezone,
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
