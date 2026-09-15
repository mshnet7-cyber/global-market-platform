import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "store";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return NextResponse.redirect(new URL("/dashboard?error=store", request.url));
  const { data: org } = await supabase.from("gmp_organizations").select("id").eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!org) return NextResponse.redirect(new URL("/dashboard?error=organization", request.url));
  const base = slugify(name);
  let slug = base;
  for (let i = 1; i < 100; i += 1) {
    const { data: exists } = await supabase.from("gmp_stores").select("id").eq("slug", slug).maybeSingle();
    if (!exists) break;
    slug = `${base}-${i + 1}`;
  }
  const { data: store, error } = await supabase.from("gmp_stores").insert({ organization_id: org.id, name, slug, country_code: "OM", currency: "OMR", timezone: "Asia/Muscat" }).select("id").single();
  if (error || !store) return NextResponse.redirect(new URL("/dashboard?error=store", request.url));
  await supabase.from("gmp_store_settings").insert({ store_id: store.id });
  return NextResponse.redirect(new URL("/dashboard?created=store", request.url));
}
