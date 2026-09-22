import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { isSameOriginRequest } from "../../../../lib/request-security";
import { clearDemoSession } from "../../../../lib/demo-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new NextResponse(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json" } });
  await clearDemoSession();
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?logged_out=1", request.url));
}
