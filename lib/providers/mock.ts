import type { MetalSnapshot, NewsItem, Quote } from "../types";
import { makeMetalSnapshot } from "../price-engine";

const now = () => new Date().toISOString();

export function mockGold(currency = "OMR"): MetalSnapshot {
  const fx: Record<string, number> = {
    OMR: 0.3845, SAR: 3.75, AED: 3.6725, USD: 1, GBP: 1 / 0.795, EUR: 1 / 0.855, TRY: 41.2,
  };
  return makeMetalSnapshot({
    instrument: "XAU/USD", metal: "gold", ounceUsd: 3668.42, bidUsd: 3667.91, askUsd: 3668.93,
    localPerUsd: fx[currency] ?? 1, currency, provider: "Demo data", timestamp: now(), status: "DEMO",
  });
}

export function mockSilver(currency = "OMR"): MetalSnapshot {
  const fx: Record<string, number> = {
    OMR: 0.3845, SAR: 3.75, AED: 3.6725, USD: 1, GBP: 1 / 0.795, EUR: 1 / 0.855, TRY: 41.2,
  };
  return makeMetalSnapshot({
    instrument: "XAG/USD", metal: "silver", ounceUsd: 42.91, bidUsd: 42.86, askUsd: 42.96,
    localPerUsd: fx[currency] ?? 1, currency, provider: "Demo data", timestamp: now(), status: "DEMO",
  });
}

export function mockMarkets(): Quote[] {
  const timestamp = now();
  return [
    { instrument: "S&P 500", spot: 6525.71, bid: null, ask: null, currency: "USD", unit: "index", timestamp, provider: "Demo data", status: "DEMO" },
    { instrument: "NASDAQ Composite", spot: 21764.45, bid: null, ask: null, currency: "USD", unit: "index", timestamp, provider: "Demo data", status: "DEMO" },
    { instrument: "Dow Jones", spot: 45672.91, bid: null, ask: null, currency: "USD", unit: "index", timestamp, provider: "Demo data", status: "DEMO" },
    { instrument: "Nikkei 225", spot: 44758.21, bid: null, ask: null, currency: "JPY", unit: "index", timestamp, provider: "Demo data", status: "DEMO" },
  ];
}

export function mockStocks(): Quote[] {
  const timestamp = now();
  return [
    { instrument: "Apple", spot: 237.88, bid: null, ask: null, currency: "USD", unit: "share", timestamp, provider: "Demo data", status: "DEMO" },
    { instrument: "Microsoft", spot: 506.27, bid: null, ask: null, currency: "USD", unit: "share", timestamp, provider: "Demo data", status: "DEMO" },
    { instrument: "NVIDIA", spot: 177.29, bid: null, ask: null, currency: "USD", unit: "share", timestamp, provider: "Demo data", status: "DEMO" },
    { instrument: "Amazon", spot: 230.12, bid: null, ask: null, currency: "USD", unit: "share", timestamp, provider: "Demo data", status: "DEMO" },
  ];
}

export function mockNews(language = "ar"): NewsItem[] {
  const publishedAt = now();
  return [
    { id: "demo-gold", title: language === "ar" ? "بيانات الذهب التجريبية للمعاينة" : "Demo gold data for preview", source: "Demo", url: "#", publishedAt, language, category: "gold", urgency: 40, confidence: 100, status: "DEMO" },
    { id: "demo-market", title: language === "ar" ? "بيانات الأسواق التجريبية للعرض فقط" : "Demo market data for display only", source: "Demo", url: "#", publishedAt, language, category: "markets", urgency: 30, confidence: 100, status: "DEMO" },
  ];
}
