import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return NextResponse.json({
    ok: true,
    service: "global-market-platform",
    version: "0.3.1",
    supabaseConfigured,
    timestamp: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
