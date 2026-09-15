import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

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
  if (data.session) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.redirect(new URL("/login?created=1", request.url));
}
