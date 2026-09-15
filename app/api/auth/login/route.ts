import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || password.length < 1) return NextResponse.redirect(new URL("/login?error=invalid", request.url));

  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse("Supabase is not configured.", { status: 503 });

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.redirect(new URL("/login?error=credentials", request.url));
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
