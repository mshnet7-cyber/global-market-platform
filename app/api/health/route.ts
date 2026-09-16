import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const missing: string[] = [];
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!publishableKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  return NextResponse.json({
    ok: missing.length === 0,
    service: "global-market-platform",
    version: "0.3.2",
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publishableKey),
    adminConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    missingEnvironmentVariables: missing,
    timestamp: new Date().toISOString(),
  }, {
    status: missing.length === 0 ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
