import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

function safeNext(value: unknown) {
  const next = String(value ?? "").trim();
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function POST(request: Request) {
  const form = await request.formData();
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
