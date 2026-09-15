import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return NextResponse.redirect(new URL("/display?error=not_configured", request.url));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/display", request.url));
  const form = await request.formData();
  const screenId = String(form.get("screen_id") ?? "").trim();
  if (!screenId) return NextResponse.redirect(new URL("/display?error=invalid", request.url));

  const { data: screen } = await admin.from("gmp_screens").select("id,store_id").eq("id", screenId).maybeSingle();
  if (!screen) return NextResponse.redirect(new URL("/display?error=screen", request.url));
  const { data: store } = await admin.from("gmp_stores").select("organization_id").eq("id", screen.store_id).maybeSingle();
  if (!store) return NextResponse.redirect(new URL("/display?error=store", request.url));
  const { data: org } = await admin.from("gmp_organizations").select("id").eq("id", store.organization_id).eq("owner_id", user.id).maybeSingle();
  if (!org) return NextResponse.redirect(new URL("/display?error=forbidden", request.url));

  const now = new Date().toISOString();
  const { error: sessionError } = await admin.from("gmp_screen_sessions").update({ revoked_at: now }).eq("screen_id", screenId).is("revoked_at", null);
  if (sessionError) return NextResponse.redirect(new URL("/display?error=revoke", request.url));
  const { error } = await admin.from("gmp_screens").update({ status: "revoked", updated_at: now }).eq("id", screenId);
  if (error) return NextResponse.redirect(new URL("/display?error=revoke", request.url));
  return NextResponse.redirect(new URL("/display?revoked=1", request.url));
}
