import type { Quote } from "../types";

const TIMEOUT_MS = 5000;
const MAX_EOD_AGE_MS = 72 * 60 * 60 * 1000;

type MarketProvider = "Alpha Vantage" | "EODHD";

type ProviderResult = {
  quotes: Quote[];
  provider: MarketProvider;
};

function parseNumber(value: unknown) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function isFresh(timestamp: string | null) {
  if (!timestamp) return false;
  const age = Date.now() - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -24 * 60 * 60 * 1000 && age <= MAX_EOD_AGE_MS;
}

async function safeJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function commercialDisplayAllowed() {
  return process.env.MARKET_DATA_DISPLAY_LICENSED === "true";
}

function configuredProvider(): "alpha" | "eodhd" | "auto" {
  const value = String(process.env.MARKET_DATA_PROVIDER ?? "auto").toLowerCase();
  return value === "alpha" || value === "eodhd" ? value : "auto";
}

export const MARKET_SYMBOLS = [
  { symbol: "AAPL", name: "Apple", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft", exchange: "NASDAQ" },
  { symbol: "NVDA", name: "NVIDIA", exchange: "NASDAQ" },
  { symbol: "AMZN", name: "Amazon", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet", exchange: "NASDAQ" },
  { symbol: "META", name: "Meta Platforms", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla", exchange: "NASDAQ" },
  { symbol: "JPM", name: "JPMorgan Chase", exchange: "NYSE" },
  { symbol: "KO", name: "Coca-Cola", exchange: "NYSE" },
  { symbol: "XOM", name: "Exxon Mobil", exchange: "NYSE" },
] as const;

export const MARKET_INDEX_SYMBOLS = [
  { symbol: "SPY", name: "S&P 500 ETF", exchange: "NYSE Arca" },
  { symbol: "QQQ", name: "Nasdaq-100 ETF", exchange: "NASDAQ" },
  { symbol: "DIA", name: "Dow Jones ETF", exchange: "NYSE Arca" },
  { symbol: "EWJ", name: "Japan ETF", exchange: "NYSE Arca" },
] as const;

function alphaUrl(symbol: string) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return null;
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", key);
  return url.toString();
}

async function fetchAlpha(symbols: readonly { symbol: string; name: string; exchange: string }[]): Promise<ProviderResult | null> {
  if (!commercialDisplayAllowed()) return null;
  if (!process.env.ALPHA_VANTAGE_API_KEY) return null;
  const results: Quote[] = [];

  for (const item of symbols) {
    const url = alphaUrl(item.symbol);
    if (!url) continue;
    try {
      const json = await safeJson(url);
      const q = json?.["Global Quote"];
      const close = parseNumber(q?.["05. price"]);
      const open = parseNumber(q?.["02. open"]);
      const previousClose = parseNumber(q?.["08. previous close"]);
      const date = validTimestamp(q?.["07. latest trading day"] + "T23:59:59Z");
      if (close == null || !date || !isFresh(date)) continue;
      const change = parseNumber(q?.["09. change"]);
      const pct = String(q?.["10. change percent"] ?? "").replace("%", "");
      const bid = close;
      const ask = close;
      results.push({
        instrument: `${item.name} (${item.symbol})`,
        spot: close,
        bid,
        ask,
        currency: "USD",
        unit: "share",
        timestamp: date,
        provider: "Alpha Vantage",
        status: "DELAYED",
      });
      void open;
      void previousClose;
      void change;
      void pct;
    } catch {
      // Continue with the next symbol. Provider failures are non-fatal.
    }
  }

  return results.length ? { quotes: results, provider: "Alpha Vantage" } : null;
}

async function fetchEodhd(symbols: readonly { symbol: string; name: string; exchange: string }[]): Promise<ProviderResult | null> {
  if (!commercialDisplayAllowed()) return null;
  const key = process.env.EODHD_API_KEY;
  if (!key) return null;
  const results: Quote[] = [];

  for (const item of symbols) {
    try {
      const url = new URL(`https://eodhd.com/api/real-time/${encodeURIComponent(item.symbol)}.${encodeURIComponent(item.exchange === "NASDAQ" ? "US" : "US")}`);
      url.searchParams.set("api_token", key);
      url.searchParams.set("fmt", "json");
      const json = await safeJson(url.toString());
      const close = parseNumber(json?.close ?? json?.previousClose);
      const date = validTimestamp(json?.timestamp ? new Date(Number(json.timestamp) * 1000).toISOString() : json?.date);
      if (close == null || !date || !isFresh(date)) continue;
      results.push({
        instrument: `${item.name} (${item.symbol})`,
        spot: close,
        bid: parseNumber(json?.bid),
        ask: parseNumber(json?.ask),
        currency: "USD",
        unit: "share",
        timestamp: date,
        provider: "EODHD",
        status: "DELAYED",
      });
    } catch {
      // Continue with the next symbol. Provider failures are non-fatal.
    }
  }

  return results.length ? { quotes: results, provider: "EODHD" } : null;
}

export async function getPublicMarketQuotes(kind: "stocks" | "markets"): Promise<ProviderResult> {
  const symbols = kind === "stocks" ? MARKET_SYMBOLS : MARKET_INDEX_SYMBOLS;
  const configured = configuredProvider();
  const providers = configured === "alpha" ? ["alpha"] : configured === "eodhd" ? ["eodhd"] : ["alpha", "eodhd"];

  for (const provider of providers) {
    const result = provider === "alpha" ? await fetchAlpha(symbols) : await fetchEodhd(symbols);
    if (result?.quotes.length) return result;
  }

  return { quotes: [], provider: configured === "eodhd" ? "EODHD" : "Alpha Vantage" };
}
