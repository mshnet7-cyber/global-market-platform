import { createSupabaseAdminClient } from "./supabase/admin";

export const HISTORY_RANGES = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
} as const;

export type HistoryRange = keyof typeof HISTORY_RANGES;

export type PublicPricePoint = {
  instrument_code: string;
  value: number | null;
  bid: number | null;
  ask: number | null;
  currency: string;
  unit: string;
  status: string;
  observed_at: string;
  provider: string | null;
};

export async function getPublicPriceHistory(instrumentCode: string, range: HistoryRange = "1D", limit = 240) {
  const admin = createSupabaseAdminClient();
  if (!admin) return [] as PublicPricePoint[];
  const maxAge = HISTORY_RANGES[range] ?? HISTORY_RANGES["1D"];
  const since = new Date(Date.now() - maxAge).toISOString();
  const safeLimit = Math.min(1000, Math.max(1, Math.floor(limit)));
  const { data, error } = await admin
    .from("gmp_price_quotes")
    .select("instrument_code,value,bid,ask,currency,unit,status,observed_at,provider")
    .eq("instrument_code", instrumentCode.toUpperCase())
    .gte("observed_at", since)
    .order("observed_at", { ascending: true })
    .limit(safeLimit);
  if (error) return [] as PublicPricePoint[];
  return (data ?? []) as PublicPricePoint[];
}
