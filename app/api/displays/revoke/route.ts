import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getMerchantContext } from "../../../../lib/merchant-access";
import { readBoundedRequestFormData } from "../../../../lib/bounded-body";

export async function POST(request: Request) {
  const context = await getMerchantContext();
  const admin = createSupabaseAdminClient();
  if (!context.user) return NextResponse.redirect(new URL("/login?next=/display", request.url));
  if (!context.organization || !context.planCode || context.role === "viewer") {
    return NextResponse.redirect(new URL("/display?error=forbidden", request.url));
  }
  if (!admin) return NextResponse.redirect(new URL("/display?error=not_configured", request.url));

  let form: FormData;
  try { form = await readBoundedRequestFormData(request, 64 * 1024); }
  catch (error) { return new NextResponse(error instanceof Error && error.message === "request_body_too_large" ? "Request body too large." : "Invalid request body.", { status: 400 }); }


  const screenId = String(form.get("screen_id") ?? "").trim();
  if (!screenId) return NextResponse.redirect(new URL("/display?error=invalid", request.url));

  const { data: screen } = await admin.from("gmp_screens").select("id,store_id").eq("id", screenId).maybeSingle();
  if (!screen) return NextResponse.redirect(new URL("/display?error=screen", request.url));
  const { data: store } = await admin.from("gmp_stores").select("organization_id").eq("id", screen.store_id).eq("organization_id", context.organization.id).maybeSingle();
  if (!store) return NextResponse.redirect(new URL("/display?error=forbidden", request.url));

  const now = new Date().toISOString();
  const { error: sessionError } = await admin.from("gmp_screen_sessions").update({ revoked_at: now }).eq("screen_id", screenId).is("revoked_at", null);
  if (sessionError) return NextResponse.redirect(new URL("/display?error=revoke", request.url));
  const { error } = await admin.from("gmp_screens").update({ status: "revoked", updated_at: now }).eq("id", screenId);
  if (error) return NextResponse.redirect(new URL("/display?error=revoke", request.url));
  return NextResponse.redirect(new URL("/display?revoked=1", request.url));
}
