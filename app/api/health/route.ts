import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  return NextResponse.json({
    ok: missing.length === 0,
    service: "global-market-platform",
    version: "0.3.2",
    supabaseConfigured: missing.every((name) => !name.startsWith("NEXT_PUBLIC_SUPABASE_")),
    adminConfigured: !missing.includes("SUPABASE_SERVICE_ROLE_KEY"),
    missingEnvironmentVariables: missing,
    timestamp: new Date().toISOString(),
  }, {
    status: missing.length === 0 ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
