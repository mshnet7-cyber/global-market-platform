import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../../lib/request-security";
import { readBoundedRequestFormData } from "../../../../lib/bounded-body";

function safeNext(value: unknown) {
  const next = String(value ?? "").trim();
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json" } });
  let form: FormData;
  try { form = await readBoundedRequestFormData(request, 32 * 1024); }
  catch (error) { return new NextResponse(error instanceof Error && error.message === "request_body_too_large" ? "Request body too large." : "Invalid request body.", { status: error instanceof Error && error.message === "request_body_too_large" ? 413 : 400 }); }
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  if (!email || password.length < 1) return NextResponse.redirect(new URL(`/login?error=invalid&next=${encodeURIComponent(next)}`, request.url));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 503 });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.redirect(new URL(`/login?error=credentials&next=${encodeURIComponent(next)}`, request.url));
  return NextResponse.redirect(new URL(next, request.url));
}
