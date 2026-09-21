import type { Quote } from "../types";
import { readBoundedJson } from "../stage3/provider-http";

const TIMEOUT_MS = 5000;
const MAX_PROVIDER_JSON_BYTES = 512 * 1024;
const MAX_EOD_AGE_MS = 72 * 60 * 60 * 1000;

type MarketProvider = "Alpha Vantage" | "EODHD";
type SymbolDef = { symbol: string; name: string; exchange: string };
type ProviderResult = { quotes: Quote[]; provider: MarketProvider };

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

async function safeJson<T = any>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await readBoundedJson<T>(response, MAX_PROVIDER_JSON_BYTES);
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
] as const satisfies readonly SymbolDef[];

export const MARKET_INDEX_SYMBOLS = [
  { symbol: "SPY", name: "S&P 500 ETF", exchange: "NYSE Arca" },
  { symbol: "QQQ", name: "Nasdaq-100 ETF", exchange: "NASDAQ" },
  { symbol: "DIA", name: "Dow Jones ETF", exchange: "NYSE Arca" },
  { symbol: "EWJ", name: "Japan ETF", exchange: "NYSE Arca" },
] as const satisfies readonly SymbolDef[];

function alphaUrl(params: Record<string, string>) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) return null;
  const url = new URL("https://www.alphavantage.co/query");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("apikey", key);
  return url.toString();
}

function alphaQuote(item: SymbolDef, q: Record<string, unknown>): Quote | null {
  const close = parseNumber(q["05. price"]);
  const previousClose = parseNumber(q["08. previous close"]);
  const change = parseNumber(q["09. change"]);
  const changePercent = parseNumber(String(q["10. change percent"] ?? "").replace("%", ""));
  const date = validTimestamp(`${String(q["07. latest trading day"] ?? "")}T23:59:59Z`);
  if (close == null || !date || !isFresh(date)) return null;
  return {
    instrument: `${item.name} (${item.symbol})`,
    symbol: item.symbol,
    exchange: item.exchange,
    spot: close,
    bid: close,
    ask: close,
    previousClose,
    change,
    changePercent,
    currency: "USD",
    unit: "share",
    timestamp: date,
    provider: "Alpha Vantage",
    status: "DELAYED",
    receivedAt: new Date().toISOString(),
  };
}

async function fetchAlpha(symbols: readonly SymbolDef[]): Promise<ProviderResult | null> {
  if (!commercialDisplayAllowed()) return null;
  const url = alphaUrl({ function: "TOP_GAINERS_LOSERS" });
  if (!url) return null;
  try {
    const json = await safeJson<Record<string, any>>(url);
    const allowed = new Map(symbols.map((item) => [item.symbol, item]));
    const rows = [
      ...(Array.isArray(json?.top_gainers) ? json.top_gainers : []),
      ...(Array.isArray(json?.top_losers) ? json.top_losers : []),
      ...(Array.isArray(json?.most_actively_traded) ? json.most_actively_traded : []),
    ];
    const seen = new Set<string>();
    const quotes: Quote[] = [];
    for (const row of rows) {
      const symbol = String(row?.ticker ?? "").toUpperCase();
      const item = allowed.get(symbol);
      if (!item || seen.has(symbol)) continue;
      const quote = alphaQuote(item, {
        "05. price": row?.price,
        "07. latest trading day": row?.last_updated,
        "08. previous close": row?.previous_close,
        "09. change": row?.change_amount,
        "10. change percent": row?.change_percentage,
      });
      if (quote) {
        seen.add(symbol);
        quotes.push(quote);
      }
    }
    return quotes.length ? { quotes, provider: "Alpha Vantage" } : null;
  } catch {
    return null;
  }
}

async function fetchEodhd(symbols: readonly SymbolDef[]): Promise<ProviderResult | null> {
  if (!commercialDisplayAllowed()) return null;
  const key = process.env.EODHD_API_KEY;
  if (!key) return null;
  const results: Array<Quote | null> = await Promise.all(symbols.map(async (item): Promise<Quote | null> => {
    try {
      const url = new URL(`https://eodhd.com/api/real-time/${encodeURIComponent(item.symbol)}.US`);
      url.searchParams.set("api_token", key);
      url.searchParams.set("fmt", "json");
      const json = await safeJson<Record<string, any>>(url.toString());
      const close = parseNumber(json?.close ?? json?.previousClose);
      const timestamp = json?.timestamp ? new Date(Number(json.timestamp) * 1000).toISOString() : validTimestamp(json?.date);
      const previousClose = parseNumber(json?.previousClose);
      if (close == null || !timestamp || !isFresh(timestamp)) return null;
      const change = previousClose == null ? null : close - previousClose;
      const changePercent = previousClose ? (change! / previousClose) * 100 : null;
      return {
        instrument: `${item.name} (${item.symbol})`,
        symbol: item.symbol,
        exchange: item.exchange,
        spot: close,
        bid: parseNumber(json?.bid),
        ask: parseNumber(json?.ask),
        previousClose,
        change,
        changePercent,
        currency: "USD",
        unit: "share",
        timestamp,
        provider: "EODHD",
        status: "DELAYED",
        receivedAt: new Date().toISOString(),
      } satisfies Quote;
    } catch {
      return null;
    }
  }));
  const quotes = results.filter((quote): quote is Quote => quote !== null);
  return quotes.length ? { quotes, provider: "EODHD" } : null;
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
