import type { MetalSnapshot } from "./types";

export const TROY_OUNCE_GRAMS = 31.1034768;
const PURITY: Record<string, number> = {
  "24K": 24 / 24,
  "22K": 22 / 24,
  "21K": 21 / 24,
  "18K": 18 / 24,
  "14K": 14 / 24,
};

export function gram24kFromOunce(ounce: number | null) {
  return ounce == null ? null : ounce / TROY_OUNCE_GRAMS;
}

export function buildPurities(gram24k: number | null) {
  return Object.fromEntries(
    Object.entries(PURITY).map(([label, factor]) => [label, gram24k == null ? null : gram24k * factor]),
  );
}

export function convertUsd(value: number | null, localPerUsd: number | null) {
  if (value == null || localPerUsd == null || localPerUsd <= 0) return null;
  return value * localPerUsd;
}

export function makeMetalSnapshot(params: {
  instrument: string;
  metal: "gold" | "silver";
  ounceUsd: number | null;
  bidUsd: number | null;
  askUsd: number | null;
  localPerUsd: number | null;
  currency: string;
  provider: string;
  timestamp: string | null;
  status: MetalSnapshot["status"];
}): MetalSnapshot {
  const spot = convertUsd(params.ounceUsd, params.localPerUsd);
  const bid = convertUsd(params.bidUsd, params.localPerUsd);
  const ask = convertUsd(params.askUsd, params.localPerUsd);
  const perGram24k = gram24kFromOunce(spot);
  return {
    instrument: params.instrument,
    metal: params.metal,
    spot,
    bid,
    ask,
    currency: params.currency,
    unit: "troy_ounce",
    timestamp: params.timestamp,
    provider: params.provider,
    status: params.status,
    perGram24k,
    purities: params.metal === "gold" ? buildPurities(perGram24k) : { "999": perGram24k },
  };
}
