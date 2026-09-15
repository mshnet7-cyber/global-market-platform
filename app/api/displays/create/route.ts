import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return new NextResponse("Display management is not configured.", { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/display", request.url));
  const form = await request.formData();
  const storeId = String(form.get("store_id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  if (!storeId || !name) return NextResponse.redirect(new URL("/display?error=invalid", request.url));
  const { data: store } = await supabase.from("gmp_stores").select("id,organization_id").eq("id", storeId).maybeSingle();
  if (!store) return NextResponse.redirect(new URL("/display?error=store", request.url));
  const { data: org } = await supabase.from("gmp_organizations").select("id").eq("id", store.organization_id).eq("owner_id", user.id).maybeSingle();
  if (!org) return NextResponse.redirect(new URL("/display?error=forbidden", request.url));
  const { data: screen, error } = await admin.from("gmp_screens").insert({ store_id: storeId, name, status: "unpaired", template: "classic" }).select("id").single();
  if (error || !screen) return NextResponse.redirect(new URL("/display?error=screen", request.url));
  return NextResponse.redirect(new URL(`/display?screen=${screen.id}&created=1`, request.url));
}
