import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publishableKey);
  const adminConfigured = Boolean(adminKey);
  const ok = supabaseConfigured && adminConfigured;

  return NextResponse.json({
    ok,
    service: "global-market-platform",
    version: "0.3.2",
    supabaseConfigured,
    adminConfigured,
    timestamp: new Date().toISOString(),
  }, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
