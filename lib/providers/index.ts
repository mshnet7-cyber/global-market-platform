import { unstable_cache } from "next/cache";
import { mockGold, mockMarkets, mockNews, mockSilver, mockStocks } from "./mock";
import { getPublicMarketQuotes } from "./market-data";
import { fetchMarketaux, fetchNewsData, getFreeMetal, rankAndDeduplicateNews } from "../free-data";
import { createSupabaseAdminClient } from "../supabase/admin";
import { withTrustStatus } from "../market-trust";
import { evaluateMarketAlerts } from "../alerts";
import { providerCode, recordProviderOutcome } from "../provider-observability";
import type { Quote } from "../types";

export const providerRegistry = {
  gold: ["Gold API", "Current.Gold (backup)", "Demo fallback"],
  silver: ["Gold API", "Current.Gold (backup)", "Demo fallback"],
  fx: ["Frankfurter", "CBO for OMR", "Demo fallback"],
  markets: ["Alpha Vantage (EOD/delayed, licensed display required)", "EODHD (EOD, licensed display required)", "Demo fallback"],
  stocks: ["Alpha Vantage (EOD/delayed, licensed display required)", "EODHD (EOD, licensed display required)", "Demo fallback"],
  news: ["Marketaux", "NewsData.io", "Official feeds / RSS where permitted", "Demo fallback"],
} as const;

function quoteInstrumentCode(metal: "gold" | "silver", currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  if (normalizedCurrency !== "OMR" && normalizedCurrency !== "USD") return null;
  return (metal === "gold" ? "XAU" : "XAG") + normalizedCurrency;
}

async function persistMetalSnapshot(snapshot: Awaited<ReturnType<typeof getFreeMetal>>) {
  if (!snapshot?.timestamp || snapshot.spot == null) return;
  if (snapshot.metal !== "gold" && snapshot.metal !== "silver") return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const instrumentCode = quoteInstrumentCode(snapshot.metal, snapshot.currency);
  if (!instrumentCode) return;
  const observedAt = new Date(snapshot.timestamp).toISOString();
  const provider = snapshot.provider.split(" + ")[0] || snapshot.provider;
  try {
    const { data: latest } = await admin
      .from("gmp_price_quotes")
      .select("observed_at,value")
      .eq("instrument_code", instrumentCode)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest || new Date(latest.observed_at).toISOString() !== observedAt) {
      await admin.from("gmp_price_quotes").insert({
        instrument_code: instrumentCode,
        bid: snapshot.bid,
        ask: snapshot.ask,
        value: snapshot.spot,
        currency: snapshot.currency,
        unit: snapshot.unit,
        status: snapshot.status,
        observed_at: observedAt,
        provider,
      });
    }

    await admin.from("gmp_price_snapshots").upsert({
      snapshot_key: snapshot.metal + ":" + snapshot.currency,
      payload: snapshot,
      status: snapshot.status,
      observed_at: observedAt,
      provider,
    }, { onConflict: "snapshot_key" });

    const previous = latest?.value == null ? null : Number(latest.value);
    const changePercent = previous && Number.isFinite(previous) && previous !== 0
      ? ((snapshot.spot - previous) / previous) * 100
      : null;
    await recordProviderOutcome(snapshot.provider, "success");
    await evaluateMarketAlerts({
      instrumentCode,
      value: snapshot.spot,
      changePercent,
      providerCode: providerCode(snapshot.provider),
      providerStatus: snapshot.status === "LIVE" || snapshot.status === "DELAYED" ? "healthy" : "unhealthy",
      providerName: snapshot.provider,
      currency: snapshot.currency,
    });
  } catch {
    // Persistence/observability must never block a valid quote.
  }
}

async function persistPublicQuotes(quotes: Quote[]) {
  const admin = createSupabaseAdminClient();
  if (!admin || !quotes.length) return;
  try {
    const instruments = quotes
      .filter((quote) => quote.symbol && /^[A-Z0-9_.:-]{2,24}$/i.test(quote.symbol))
      .map((quote) => ({ code: String(quote.symbol).toUpperCase(), name: quote.instrument, asset_type: quote.metal ? "metal" : "market" }));
    if (instruments.length) await admin.from("gmp_instruments").upsert(instruments, { onConflict: "code" });

    for (const rawQuote of quotes) {
      const quote = withTrustStatus(rawQuote);
      if (!quote.symbol || quote.spot == null || !quote.timestamp) continue;
      const instrumentCode = String(quote.symbol).toUpperCase();
      const observedAt = new Date(quote.timestamp).toISOString();
      const { data: latest } = await admin.from("gmp_price_quotes").select("observed_at").eq("instrument_code", instrumentCode).order("observed_at", { ascending: false }).limit(1).maybeSingle();
      if (!latest || new Date(latest.observed_at).toISOString() !== observedAt) {
        await admin.from("gmp_price_quotes").insert({
          instrument_code: instrumentCode,
          bid: quote.bid,
          ask: quote.ask,
          value: quote.spot,
          currency: quote.currency,
          unit: quote.unit,
          status: quote.status,
          observed_at: observedAt,
          provider: quote.provider,
        });
      }
      await evaluateMarketAlerts({
        instrumentCode,
        value: quote.spot,
        changePercent: quote.changePercent ?? null,
        providerCode: providerCode(quote.provider),
        providerStatus: quote.status === "LIVE" || quote.status === "DELAYED" ? "healthy" : "unhealthy",
        providerName: quote.provider,
        currency: quote.currency,
      });
    }
    const providers = [...new Set(quotes.map((quote) => quote.provider))];
    await Promise.all(providers.map((name) => recordProviderOutcome(name, "success")));
  } catch {
    // History and alert persistence must never break quote delivery.
  }
}

async function buildSnapshot(currency = "OMR", language = "ar", allowDemo = false, includePublicMarkets = false) {
  const marketPromises = includePublicMarkets
    ? [getPublicMarketQuotes("markets"), getPublicMarketQuotes("stocks")]
    : [Promise.resolve({ quotes: [], provider: "Alpha Vantage" as const }), Promise.resolve({ quotes: [], provider: "Alpha Vantage" as const })];

  const started = Date.now();
  const [liveGold, liveSilver, marketauxNews, newsdataNews, publicMarkets, publicStocks] = await Promise.all([
    getFreeMetal(currency, "XAU", "gold"),
    getFreeMetal(currency, "XAG", "silver"),
    fetchMarketaux(language),
    fetchNewsData(language),
    ...marketPromises,
  ]);

  await Promise.all([
    persistMetalSnapshot(liveGold),
    persistMetalSnapshot(liveSilver),
    persistPublicQuotes(publicMarkets.quotes),
    persistPublicQuotes(publicStocks.quotes),
  ]);

  if (!liveGold) {
    await recordProviderOutcome("Gold API", "failure", Date.now() - started);
    await evaluateMarketAlerts({ instrumentCode: quoteInstrumentCode("gold", currency) ?? "XAUGLOBAL", value: null, providerCode: "gold_api", providerStatus: "unhealthy", providerName: "Gold API", currency });
  }
  if (!liveSilver) await recordProviderOutcome("Gold API", "failure");

  const news = rankAndDeduplicateNews([...(marketauxNews ?? []), ...(newsdataNews ?? [])]);
  const unavailableGold = mockGold(currency);
  const unavailableSilver = mockSilver(currency);
  return {
    gold: liveGold ?? (allowDemo ? unavailableGold : { ...unavailableGold, status: "UNAVAILABLE" as const, spot: null, bid: null, ask: null, perGram24k: null, purities: Object.fromEntries(Object.keys(unavailableGold.purities).map((key) => [key, null])) }),
    silver: liveSilver ?? (allowDemo ? unavailableSilver : { ...unavailableSilver, status: "UNAVAILABLE" as const, spot: null, bid: null, ask: null, perGram24k: null, purities: { "999": null } }),
    markets: allowDemo ? mockMarkets() : publicMarkets.quotes,
    stocks: allowDemo ? mockStocks() : publicStocks.quotes,
    news: news.length ? news : (allowDemo ? mockNews(language) : []),
    providers: providerRegistry,
    generatedAt: new Date().toISOString(),
  };
}

export async function getSnapshot(currency = "OMR", language = "ar", allowDemo = false, includePublicMarkets = false) {
  const normalizedCurrency = currency.toUpperCase();
  const normalizedLanguage = language.toLowerCase();
  const cached = unstable_cache(
    () => buildSnapshot(normalizedCurrency, normalizedLanguage, allowDemo, includePublicMarkets),
    ["market-snapshot", normalizedCurrency, normalizedLanguage, allowDemo ? "demo" : "live", includePublicMarkets ? "with-quotes" : "metals-news"],
    { revalidate: 15, tags: ["market-snapshot:" + normalizedCurrency + ":" + normalizedLanguage] },
  );
  return cached();
}
