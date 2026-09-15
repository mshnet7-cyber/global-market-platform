import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "account";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || !email || password.length < 10) return NextResponse.redirect(new URL("/signup?error=invalid", request.url));
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 503 });
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
  if (error) return NextResponse.redirect(new URL("/signup?error=signup", request.url));
  if (!data.session || !data.user) return NextResponse.redirect(new URL("/login?created=1", request.url));
  const { error: profileError } = await supabase.from("gmp_profiles").upsert({ id: data.user.id, display_name: name }, { onConflict: "id" });
  if (profileError) return NextResponse.redirect(new URL("/signup?error=profile", request.url));
  const slug = `${slugify(name)}-${data.user.id.slice(0, 8)}`;
  const { data: org, error: orgError } = await supabase.from("gmp_organizations").insert({ name, slug, owner_id: data.user.id }).select("id").single();
  if (orgError || !org) return NextResponse.redirect(new URL("/signup?error=organization", request.url));
  if (!admin) return NextResponse.redirect(new URL("/signup?error=not_configured", request.url));
  const { error: memberError } = await admin.from("gmp_organization_members").insert({ organization_id: org.id, user_id: data.user.id, role: "owner" });
  if (memberError) return NextResponse.redirect(new URL("/signup?error=membership", request.url));
  const storeSlug = `${slugify(name)}-${data.user.id.slice(0, 8)}`;
  const { error: storeError } = await admin.from("gmp_stores").insert({ organization_id: org.id, name, slug: storeSlug, country_code: "OM", currency: "OMR", timezone: "Asia/Muscat" });
  if (storeError) return NextResponse.redirect(new URL("/signup?error=store", request.url));
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
