import { NextResponse } from "next/server";
import { fetchFrankfurterUsdLocal, fetchGoldApi } from "../../../../lib/free-data";

export const runtime = "nodejs";

const CACHE_TTL_MS = 15_000;
let cached: {
  expiresAt: number;
  payload: {
    ok: boolean;
    checks: {
      gold: { ok: boolean; priceUsdPerOunce: number | null; bidUsd: number | null; askUsd: number | null; timestamp: string | null };
      silver: { ok: boolean; priceUsdPerOunce: number | null; timestamp: string | null };
      usdToOmr: { ok: boolean; rate: number | null };
    };
  };
} | null = null;
let inFlight: Promise<typeof cached.payload> | null = null;

async function readHealthData() {
  const [gold, silver, omrRate] = await Promise.all([
    fetchGoldApi("XAU"),
    fetchGoldApi("XAG"),
    fetchFrankfurterUsdLocal("OMR"),
  ]);

  return {
    ok: Boolean(gold?.price && silver?.price && omrRate),
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
  };
}

async function getCachedHealthData() {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.payload;
  if (inFlight) return inFlight;
  inFlight = readHealthData()
    .then((payload) => {
      cached = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
      return payload;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export async function GET() {
  const startedAt = Date.now();
  const payload = await getCachedHealthData();
  return NextResponse.json({
    ...payload,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  }, {
    status: payload.ok ? 200 : 503,
    headers: {
      "Cache-Control": "public, max-age=15, stale-while-revalidate=30",
    },
  });
}
