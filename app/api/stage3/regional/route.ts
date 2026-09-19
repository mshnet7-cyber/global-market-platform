import { NextResponse } from "next/server";
import { getRegionalProfile } from "../../../../lib/stage3/regional";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("country")?.trim().toUpperCase() || "OM";
  if (!/^[A-Z]{2}$/.test(raw)) return NextResponse.json({ error: "invalid_country" }, { status: 400 });
  return NextResponse.json(
    { data: getRegionalProfile(raw) },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
