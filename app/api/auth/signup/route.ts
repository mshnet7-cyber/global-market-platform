import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "account";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name || !email || password.length < 10) return NextResponse.redirect(new URL("/signup?error=invalid", request.url));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 503 });

  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } });
  if (error) return NextResponse.redirect(new URL("/signup?error=signup", request.url));

  if (data.session && data.user) {
    await supabase.from("gmp_profiles").upsert({ id: data.user.id, display_name: name }, { onConflict: "id" });
    const slug = `${slugify(name)}-${data.user.id.slice(0, 8)}`;
    const { data: org } = await supabase.from("gmp_organizations").insert({ name, slug, owner_id: data.user.id }).select("id").single();
    if (org) await supabase.from("gmp_stores").insert({ organization_id: org.id, name, slug }).select("id").single();
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.redirect(new URL("/login?created=1", request.url));
}
