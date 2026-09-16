import { unstable_cache } from 'next/cache';
import { mockGold, mockMarkets, mockNews, mockSilver, mockStocks } from './mock';
import { fetchMarketaux, fetchNewsData, getFreeMetal, rankAndDeduplicateNews } from '../free-data';
import { createSupabaseAdminClient } from '../supabase/admin';

export const providerRegistry = {
  gold: ['Gold API', 'Current.Gold (backup)', 'Demo fallback'],
  silver: ['Gold API', 'Current.Gold (backup)', 'Demo fallback'],
  fx: ['Frankfurter', 'CBO for OMR', 'Demo fallback'],
  news: ['Marketaux', 'NewsData.io', 'Official feeds / RSS where permitted', 'Demo fallback'],
} as const;

function quoteInstrumentCode(metal: 'gold' | 'silver', currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  if (normalizedCurrency !== 'OMR' && normalizedCurrency !== 'USD') return null;
  return `${metal === 'gold' ? 'XAU' : 'XAG'}${normalizedCurrency}`;
}

async function persistMetalSnapshot(snapshot: Awaited<ReturnType<typeof getFreeMetal>>) {
  if (!snapshot?.timestamp || snapshot.spot == null) return;
  if (snapshot.metal !== 'gold' && snapshot.metal !== 'silver') return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const instrumentCode = quoteInstrumentCode(snapshot.metal, snapshot.currency);
  if (!instrumentCode) return;
  const observedAt = new Date(snapshot.timestamp).toISOString();
  const provider = snapshot.provider.split(' + ')[0] || snapshot.provider;

  try {
    const { data: latest } = await admin
      .from('gmp_price_quotes')
      .select('observed_at')
      .eq('instrument_code', instrumentCode)
      .order('observed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latest || new Date(latest.observed_at).toISOString() !== observedAt) {
      await admin.from('gmp_price_quotes').insert({
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

    await admin.from('gmp_price_snapshots').upsert({
      snapshot_key: `${snapshot.metal}:${snapshot.currency}`,
      payload: snapshot,
      status: snapshot.status,
      observed_at: observedAt,
      provider,
    }, { onConflict: 'snapshot_key' });
  } catch {
    // Persistence must never block a valid live quote.
  }
}

async function buildSnapshot(currency = 'OMR', language = 'ar', allowDemo = false) {
  const [liveGold, liveSilver, marketauxNews, newsdataNews] = await Promise.all([
    getFreeMetal(currency, 'XAU', 'gold'),
    getFreeMetal(currency, 'XAG', 'silver'),
    fetchMarketaux(language),
    fetchNewsData(language),
  ]);

  await Promise.all([persistMetalSnapshot(liveGold), persistMetalSnapshot(liveSilver)]);

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
