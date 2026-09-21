export type DataStatus = "LIVE" | "DELAYED" | "STALE" | "ESTIMATED" | "UNAVAILABLE" | "DEMO";

export type Metal = "gold" | "silver";

export type Quote = {
  instrument: string;
  symbol?: string;
  exchange?: string;
  metal?: Metal;
  spot: number | null;
  bid: number | null;
  ask: number | null;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  currency: string;
  unit: string;
  timestamp: string | null;
  receivedAt?: string | null;
  provider: string;
  status: DataStatus;
};

export type MetalSnapshot = Quote & {
  perGram24k: number | null;
  purities: Record<string, number | null>;
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  language: string;
  country?: string;
  category: "gold" | "markets" | "stocks" | "world";
  urgency: number;
  confidence: number;
  status: DataStatus;
};
