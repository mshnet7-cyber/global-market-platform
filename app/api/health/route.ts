import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const adminConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return NextResponse.json({
    ok: true,
    service: "global-market-platform",
    version: "0.3.2",
    supabaseConfigured,
    adminConfigured,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
