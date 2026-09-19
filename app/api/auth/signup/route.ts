import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../../lib/request-security";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { appConfig, countries } from "../../../../lib/config";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "account";
}

function safeNext(value: unknown) { const next = String(value ?? "").trim(); return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"; }

function redirectWithError(request: Request, code: string, next = "/dashboard", plan = "") {
  const params = new URLSearchParams({ error: code, next });
  if (plan) params.set("plan", plan);
  return NextResponse.redirect(new URL(`/signup?${params.toString()}`, request.url));
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json" } });
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const requestedPlan = String(form.get("plan") ?? "").trim();
  const plan = ["starter", "pro", "business"].includes(requestedPlan) ? requestedPlan : "";
  if (!name || !email || password.length < 10) return redirectWithError(request, "invalid", next, plan);

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return new NextResponse("Supabase is not configured.", { status: 503 });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: name } },
  });
  if (error) return redirectWithError(request, "signup", next, plan);
  if (!data.user) return NextResponse.redirect(new URL("/login?created=1&next=" + encodeURIComponent(next), request.url));

  const country = countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const orgSlug = `${slugify(name)}-${data.user.id.slice(0, 8)}`;
  const storeSlug = `${slugify(name)}-${country.code.toLowerCase()}-${data.user.id.slice(0, 8)}`;

  const { error: bootstrapError } = await admin.rpc("gmp_bootstrap_account", {
    p_user_id: data.user.id,
    p_name: name,
    p_country_code: country.code,
    p_currency: country.currency,
    p_timezone: country.timezone,
    p_org_slug: orgSlug,
    p_store_slug: storeSlug,
  });

  if (bootstrapError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return redirectWithError(request, "account_setup", next, plan);
  }

  const continuation = plan ? next + (next.includes("?") ? "&" : "?") + "plan=" + encodeURIComponent(plan) : next;
  return data.session
    ? NextResponse.redirect(new URL(continuation, request.url))
    : NextResponse.redirect(new URL("/login?created=1&next=" + encodeURIComponent(continuation), request.url));
}
