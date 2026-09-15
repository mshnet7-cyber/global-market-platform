import { NextResponse } from "next/server";
import { fetchFrankfurterUsdLocal, fetchGoldApi } from "../../../../lib/free-data";

export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();
  const [gold, silver, omrRate] = await Promise.all([
    fetchGoldApi("XAU"),
    fetchGoldApi("XAG"),
    fetchFrankfurterUsdLocal("OMR"),
  ]);

  const ok = Boolean(gold?.price && silver?.price && omrRate);
  return NextResponse.json({
    ok,
    checks: {
      gold: {
        ok: Boolean(gold?.price),
        priceUsdPerOunce: gold?.price ?? null,
        bidUsd: gold?.bid ?? null,
        askUsd: gold?.ask ?? null,
        timestamp: gold?.timestamp ?? null,
      },
      silver: {
        ok: Boolean(silver?.price),
        priceUsdPerOunce: silver?.price ?? null,
        timestamp: silver?.timestamp ?? null,
      },
      usdToOmr: {
        ok: Boolean(omrRate),
        rate: omrRate,
      },
    },
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  }, {
    status: ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
