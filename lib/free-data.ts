import { makeMetalSnapshot } from './price-engine';
import type { MetalSnapshot, NewsItem } from './types';

const FREE_TIMEOUT_MS = 4500;
const MAX_NEWS_AGE_MS = 10 * 60 * 1000;
const MAX_METAL_AGE_MS = 10 * 60 * 1000;
const LIVE_METAL_MAX_AGE_MS = 90 * 1000;

async function safeJson(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FREE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchFrankfurterUsdLocal(currency: string): Promise<number | null> {
  const code = currency.toUpperCase();
  if (code === 'USD') return 1;
  try {
    const url = new URL(`https://api.frankfurter.dev/v2/rate/usd/${encodeURIComponent(code)}`);
    const json = await safeJson(url.toString());
    return typeof json.rate === 'number' && Number.isFinite(json.rate) && json.rate > 0 ? json.rate : null;
  } catch {
    return null;
  }
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const ms = number < 10_000_000_000 ? number * 1000 : number;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

export async function fetchGoldApi(symbol: 'XAU' | 'XAG'): Promise<{ price: number; bid: number | null; ask: number | null; timestamp: string | null } | null> {
  try {
    const json = await safeJson(`https://api.gold-api.com/price/${symbol}`);
    const price = Number(json.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    const bid = Number(json.bid);
    const ask = Number(json.ask);
    const timestamp = parseTimestamp(json.updatedAt ?? json.updated_at ?? json.timestamp);
    return {
      price,
      bid: Number.isFinite(bid) && bid > 0 ? bid : null,
      ask: Number.isFinite(ask) && ask > 0 ? ask : null,
      timestamp,
    };
  } catch {
    return null;
  }
}

export async function fetchCurrentGold(symbol: 'XAU' | 'XAG'): Promise<{ price: number; bid: number | null; ask: number | null; timestamp: string | null } | null> {
  const key = process.env.CURRENT_GOLD_API_KEY;
  const endpoint = process.env.CURRENT_GOLD_API_URL;
  if (!key || !endpoint) return null;
  try {
    const url = new URL(endpoint);
    url.searchParams.set('symbol', symbol);
    const json = await safeJson(url.toString(), {
      headers: { 'x-api-key': key, Accept: 'application/json' },
    });
    const metal = String(json.metal ?? '').toUpperCase();
    if (metal !== symbol) return null;
    const price = Number(json.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    const bid = Number(json.bid);
    const ask = Number(json.ask);
    return {
      price,
      bid: Number.isFinite(bid) && bid > 0 ? bid : null,
      ask: Number.isFinite(ask) && ask > 0 ? ask : null,
      timestamp: parseTimestamp(json.updatedAt ?? json.updated_at ?? json.timestamp),
    };
  } catch {
    return null;
  }
}

function isFresh(timestamp: string | null, maxAgeMs: number) {
  if (!timestamp) return false;
  const age = Date.now() - Date.parse(timestamp);
  return Number.isFinite(age) && age >= -60_000 && age <= maxAgeMs;
}

export async function getFreeMetal(currency: string, symbol: 'XAU' | 'XAG', metal: 'gold' | 'silver'): Promise<MetalSnapshot | null> {
  const localPerUsd = await fetchFrankfurterUsdLocal(currency);
  if (localPerUsd == null) return null;

  let quote = await fetchGoldApi(symbol);
  let provider = 'Gold API';
  if (!quote || !isFresh(quote.timestamp, MAX_METAL_AGE_MS)) {
    const backup = await fetchCurrentGold(symbol);
    if (backup && isFresh(backup.timestamp, MAX_METAL_AGE_MS)) {
      quote = backup;
      provider = 'Current.Gold';
    } else {
      quote = null;
    }
  }

  if (!quote || !isFresh(quote.timestamp, MAX_METAL_AGE_MS)) return null;
  const age = Date.now() - Date.parse(quote.timestamp!);
  const status = age <= LIVE_METAL_MAX_AGE_MS ? 'LIVE' : 'DELAYED';
  return makeMetalSnapshot({
    instrument: `${symbol}/USD`,
    metal,
    ounceUsd: quote.price,
    bidUsd: quote.bid,
    askUsd: quote.ask,
    localPerUsd,
    currency,
    provider: `${provider} + Frankfurter`,
    timestamp: quote.timestamp,
    status,
  });
}

function newsStatus(publishedAt: string): NewsItem['status'] {
  const ts = Date.parse(publishedAt);
  if (!Number.isFinite(ts)) return 'DELAYED';
  const age = Date.now() - ts;
  if (age >= -60_000 && age <= MAX_NEWS_AGE_MS) return 'LIVE';
  if (age <= 12 * 60 * 60_000) return 'DELAYED';
  return 'STALE';
}

function scoreNews(item: any) {
  const published = Date.parse(String(item.published_at ?? ''));
  const ageMinutes = Number.isFinite(published) ? Math.max(0, (Date.now() - published) / 60000) : 99999;
  const freshness = Math.max(0, 100 - Math.min(100, ageMinutes));
  const title = String(item.title ?? '').toLowerCase();
  const urgentTerms = /(breaking|urgent|alert|fed|ecb|central bank|rate|gold|oil|war|sanction|crash|surge|collapse|قرار|عاجل|ذهب|فائدة|بنك مركزي)/i;
  const urgency = urgentTerms.test(title) ? 92 : 65;
  const confidence = Number(item.entities?.length ? 86 : 74);
  return Math.round(freshness * 0.45 + confidence * 0.35 + urgency * 0.2);
}

export async function fetchMarketaux(language: string): Promise<NewsItem[] | null> {
  const token = process.env.MARKETAUX_API_TOKEN;
  if (!token) return null;
  try {
    const url = new URL('https://api.marketaux.com/v1/news/all');
    url.searchParams.set('api_token', token);
    url.searchParams.set('language', language);
    url.searchParams.set('filter_entities', 'true');
    url.searchParams.set('group_similar', 'true');
    url.searchParams.set('limit', '10');
    const json = await safeJson(url.toString());
    if (!Array.isArray(json.data)) return [];
    return json.data.map((item: any, i: number) => {
      const title = String(item.title ?? 'Untitled');
      const category = item.entities?.some((e: any) => e.type === 'equity')
        ? 'stocks'
        : /(gold|silver|precious metal|ذهب|فضة)/i.test(title)
          ? 'gold'
          : 'markets';
      const confidence = Number(item.entities?.length ? 88 : 76);
      const urgency = Number(/breaking|urgent|alert|عاجل/i.test(title) ? 96 : 68);
      return {
        id: String(item.uuid ?? `marketaux-${i}`),
        title,
        source: String(item.source ?? 'Marketaux'),
        url: String(item.url ?? '#'),
        publishedAt: String(item.published_at ?? new Date().toISOString()),
        language: String(item.language ?? language),
        country: item.source_domain ? String(item.source_domain) : undefined,
        category,
        urgency,
        confidence,
        status: newsStatus(String(item.published_at ?? new Date().toISOString())),
      } satisfies NewsItem;
    }).sort((a: NewsItem, b: NewsItem) => (b.urgency + b.confidence) - (a.urgency + a.confidence));
  } catch {
    return null;
  }
}

export async function fetchNewsData(language: string): Promise<NewsItem[] | null> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key) return null;
  try {
    const url = new URL('https://newsdata.io/api/1/latest');
    url.searchParams.set('apikey', key);
    url.searchParams.set('language', language);
    url.searchParams.set('size', '10');
    const json = await safeJson(url.toString());
    if (!Array.isArray(json.results)) return [];
    return json.results.map((item: any, i: number) => ({
      id: String(item.article_id ?? `newsdata-${i}`),
      title: String(item.title ?? 'Untitled'),
      source: String(item.source_name ?? item.source_id ?? 'NewsData.io'),
      url: String(item.link ?? '#'),
      publishedAt: String(item.pubDate ?? new Date().toISOString()),
      language,
      country: Array.isArray(item.country) ? item.country[0] : undefined,
      category: /gold|silver|metal|ذهب|فضة/i.test(String(item.title ?? '')) ? 'gold' : /stock|share|equity|سهم|أسهم/i.test(String(item.title ?? '')) ? 'stocks' : 'markets',
      urgency: /breaking|urgent|عاجل/i.test(String(item.title ?? '')) ? 94 : 64,
      confidence: 78,
      status: newsStatus(String(item.pubDate ?? new Date().toISOString())),
    } satisfies NewsItem));
  } catch {
    return null;
  }
}

export function rankAndDeduplicateNews(items: NewsItem[]) {
  const map = new Map<string, NewsItem>();
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 180);
    const existing = map.get(key);
    if (!existing || scoreNews(item) > scoreNews(existing)) map.set(key, item);
  }
  return [...map.values()].sort((a, b) => scoreNews(b) - scoreNews(a)).slice(0, 12);
}
