import type { DataStatus, Quote } from "./types";

export type TrustAssessment = {
  status: DataStatus;
  ageMs: number | null;
  trusted: boolean;
  reason: string;
};

const DEFAULT_LIVE_MAX_AGE_MS = 90 * 1000;
const DEFAULT_DELAYED_MAX_AGE_MS = 10 * 60 * 1000;
const DEFAULT_STALE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

export function assessTimestamp(
  timestamp: string | null,
  now = Date.now(),
  liveMaxAgeMs = DEFAULT_LIVE_MAX_AGE_MS,
  delayedMaxAgeMs = DEFAULT_DELAYED_MAX_AGE_MS,
  staleMaxAgeMs = DEFAULT_STALE_MAX_AGE_MS,
): TrustAssessment {
  if (!timestamp) return { status: "UNAVAILABLE", ageMs: null, trusted: false, reason: "missing_timestamp" };
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return { status: "UNAVAILABLE", ageMs: null, trusted: false, reason: "invalid_timestamp" };
  const ageMs = now - parsed;
  if (ageMs < -60_000) return { status: "UNAVAILABLE", ageMs, trusted: false, reason: "future_timestamp" };
  if (ageMs <= liveMaxAgeMs) return { status: "LIVE", ageMs: Math.max(0, ageMs), trusted: true, reason: "fresh" };
  if (ageMs <= delayedMaxAgeMs) return { status: "DELAYED", ageMs, trusted: true, reason: "delayed_within_policy" };
  if (ageMs <= staleMaxAgeMs) return { status: "STALE", ageMs, trusted: false, reason: "stale" };
  return { status: "UNAVAILABLE", ageMs, trusted: false, reason: "expired" };
}

export function assessQuote(quote: Quote | null, now = Date.now()): TrustAssessment {
  if (!quote) return { status: "UNAVAILABLE", ageMs: null, trusted: false, reason: "missing_quote" };
  if (quote.spot != null && (!Number.isFinite(quote.spot) || quote.spot < 0)) {
    return { status: "UNAVAILABLE", ageMs: null, trusted: false, reason: "invalid_value" };
  }
  const assessed = assessTimestamp(quote.timestamp, now);
  if (quote.status === "DEMO") return { ...assessed, status: "DEMO", trusted: false, reason: "demo_value" };
  return assessed.status === "UNAVAILABLE"
    ? assessed
    : { ...assessed, status: quote.status === "ESTIMATED" ? "ESTIMATED" : assessed.status };
}

export function withTrustStatus<T extends Quote>(quote: T): T {
  const trust = assessQuote(quote);
  return { ...quote, status: trust.trusted ? trust.status : trust.status === "ESTIMATED" ? "ESTIMATED" : "UNAVAILABLE" } as T;
}

export function trustLabel(status: DataStatus) {
  switch (status) {
    case "LIVE": return "LIVE";
    case "DELAYED": return "DELAYED";
    case "STALE": return "STALE";
    case "ESTIMATED": return "ESTIMATED";
    case "DEMO": return "DEMO";
    default: return "UNAVAILABLE";
  }
}
