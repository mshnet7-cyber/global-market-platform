import { MARKET_INDEX_SYMBOLS, MARKET_SYMBOLS } from "./providers/market-data";
import { createSupabaseAdminClient } from "./supabase/admin";\nimport { assessTimestamp } from "./market-trust";

export const HISTORY_RANGES = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
} as const;

export type HistoryRange = keyof typeof HISTORY_RANGES;

const PUBLIC_HISTORY_INSTRUMENTS = new Set([
  "XAUUSD", "XAGUSD", "XAUOMR", "XAGOMR",
  ...MARKET_SYMBOLS.map((item) => item.symbol),
  ...MARKET_INDEX_SYMBOLS.map((item) => item.symbol),
]);

export function isPublicHistoryInstrument(instrumentCode: string) {
  return PUBLIC_HISTORY_INSTRUMENTS.has(instrumentCode.toUpperCase());
}

export type PublicPricePoint = {
  instrument_code: string;
  value: number | null;
  bid: number | null;
  ask: number | null;
  currency: string;
  unit: string;
  status: string;
  observed_at: string;
  received_at?: string | null;
  provider: string | null;
};

export async function getPublicPriceHistory(instrumentCode: string, range: HistoryRange = "1D", limit = 240) {
  const normalizedInstrument = instrumentCode.toUpperCase();
  if (!isPublicHistoryInstrument(normalizedInstrument)) return [] as PublicPricePoint[];
  const admin = createSupabaseAdminClient();
  if (!admin) return [] as PublicPricePoint[];
  const maxAge = HISTORY_RANGES[range] ?? HISTORY_RANGES["1D"];
  const since = new Date(Date.now() - maxAge).toISOString();
  const safeLimit = Math.min(1000, Math.max(1, Math.floor(limit)));
  const { data, error } = await admin
    .from("gmp_price_quotes")
    .select("instrument_code,value,bid,ask,currency,unit,status,observed_at,received_at,provider")
    .eq("instrument_code", normalizedInstrument)
    .gte("observed_at", since)
    .order("observed_at", { ascending: true })
    .limit(safeLimit);
  if (error) return [] as PublicPricePoint[];
  return (data ?? []).map((row) => ({
    ...row,
    status: assessTimestamp(row.observed_at).status,
  })) as PublicPricePoint[];
}
