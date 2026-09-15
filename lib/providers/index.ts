import { unstable_cache } from 'next/cache';
import { mockGold, mockMarkets, mockNews, mockSilver, mockStocks } from './mock';
import { fetchMarketaux, fetchNewsData, getFreeMetal, rankAndDeduplicateNews } from '../free-data';

export const providerRegistry = {
  gold: ['Gold API', 'Current.Gold (backup)', 'Demo fallback'],
  silver: ['Gold API', 'Current.Gold (backup)', 'Demo fallback'],
  fx: ['Frankfurter', 'CBO for OMR', 'Demo fallback'],
  markets: ['Configured permitted market source', 'Configured backup market source', 'Demo fallback'],
  stocks: ['Configured permitted stock source', 'Configured backup stock source', 'Demo fallback'],
  news: ['Marketaux', 'NewsData.io', 'Official feeds / RSS where permitted', 'Demo fallback'],
};

async function buildSnapshot(currency = 'OMR', language = 'ar', allowDemo = false) {
  const [liveGold, liveSilver, marketauxNews, newsdataNews] = await Promise.all([
    getFreeMetal(currency, 'XAU', 'gold'),
    getFreeMetal(currency, 'XAG', 'silver'),
    fetchMarketaux(language),
    fetchNewsData(language),
  ]);

  const news = rankAndDeduplicateNews([...(marketauxNews ?? []), ...(newsdataNews ?? [])]);
  const unavailableGold = mockGold(currency);
  const unavailableSilver = mockSilver(currency);
  return {
    gold: liveGold ?? (allowDemo ? unavailableGold : { ...unavailableGold, status: 'UNAVAILABLE' as const, spot: null, bid: null, ask: null, perGram24k: null, purities: Object.fromEntries(Object.keys(unavailableGold.purities).map(k => [k, null])) }),
    silver: liveSilver ?? (allowDemo ? unavailableSilver : { ...unavailableSilver, status: 'UNAVAILABLE' as const, spot: null, bid: null, ask: null, perGram24k: null, purities: { '999': null } }),
    markets: allowDemo ? mockMarkets() : [],
    stocks: allowDemo ? mockStocks() : [],
    news: news.length ? news : (allowDemo ? mockNews(language) : []),
    providers: providerRegistry,
    generatedAt: new Date().toISOString(),
  };
}

export async function getSnapshot(currency = 'OMR', language = 'ar', allowDemo = false) {
  const normalizedCurrency = currency.toUpperCase();
  const normalizedLanguage = language.toLowerCase();
  const cached = unstable_cache(
    () => buildSnapshot(normalizedCurrency, normalizedLanguage, allowDemo),
    ['market-snapshot', normalizedCurrency, normalizedLanguage, allowDemo ? 'demo' : 'live'],
    { revalidate: 15, tags: [`market-snapshot:${normalizedCurrency}:${normalizedLanguage}`] },
  );
  return cached();
}
