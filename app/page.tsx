import Link from "next/link";
import { getSnapshot } from "../lib/providers";
import { appConfig, countries, isValidLanguage, languages } from "../lib/config";
import { getDisplayName, getMessages, isRtlLanguage } from "../lib/i18n";

function formatMoney(value: number | null, locale: string, currency: string, maximumFractionDigits = 3) {
  if (value == null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits }).format(value);
  } catch {
    return `${value.toLocaleString(locale, { maximumFractionDigits })} ${currency}`;
  }
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ country?: string; language?: string }> }) {
  const params = await searchParams;
  const country = countries.find((c) => c.code === params?.country?.toUpperCase()) ?? countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const language = params?.language && isValidLanguage(params.language) ? params.language.toLowerCase() : appConfig.defaultLanguage;
  const messages = getMessages(language);
  const snapshot = await getSnapshot(country.currency, language, false);
  const gold = snapshot.gold;
  const locale = `${language}-${country.code}`;
  const countryName = getDisplayName("region", country.code, language, country.name);

  return <div className="app-shell" lang={language} dir={isRtlLanguage(language) ? "rtl" : "ltr"}>
    <header className="topbar"><div className="container nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="nav-links"><Link href={`/gold?country=${country.code}&language=${language}`}>{messages.gold}</Link><Link href={`/silver?country=${country.code}&language=${language}`}>{messages.silver}</Link><Link href={`/markets?country=${country.code}&language=${language}`}>{messages.markets}</Link><Link href={`/stocks?country=${country.code}&language=${language}`}>{messages.stocks}</Link><Link href={`/news?country=${country.code}&language=${language}`}>{messages.news}</Link></nav><div className="nav-actions"><Link className="btn btn-ghost" href="/login">{messages.login}</Link><Link className="btn btn-primary" href="/demo">{messages.createDisplay}</Link></div></div></header>
    <main>
      <div className="container section"><form className="preference-bar" method="get"><label className="label">{messages.country}<select className="select" name="country" defaultValue={country.code}>{countries.map((c) => <option value={c.code} key={c.code}>{getDisplayName("region", c.code, language, c.name)} · {c.currency}</option>)}</select></label><label className="label">{messages.language}<select className="select" name="language" defaultValue={language}>{languages.map((l) => <option value={l.code} key={l.code}>{getDisplayName("language", l.code, language, l.name)}</option>)}</select></label><button className="btn" type="submit">{messages.apply}</button></form></div>
      <div className="container hero"><section><div className="kicker">GLOBAL MARKET REFERENCE</div><h1>{language === "ar" ? "أسعار وأسواق العالم، في منصة واحدة." : "World prices and markets in one platform."}</h1><p className="lede">{language === "ar" ? "ذهب وفضة وأسواق وأسهم وأخبار مالية، مع دولة ولغة وعملة قابلة للتغيير بشكل مستقل." : "Gold, silver, markets, stocks and financial news, with country, language and currency chosen independently."}</p><div className="nav-actions" style={{marginTop:24}}><Link href={`/gold?country=${country.code}&language=${language}`} className="btn btn-primary">{messages.goldView}</Link><Link href="/demo" className="btn">{messages.displayDemo}</Link></div></section>
        <section className="hero-card"><div className="row"><div><div className="card-title">{messages.gold} — {countryName}</div><div className="metric">24K / Gram</div></div><span className={`pill ${gold.status === 'LIVE' ? 'pill-live' : ''}`}>{gold.status}</span></div><div className="price-xl">{formatMoney(gold.purities["24K"] ?? null, locale, country.currency)}</div><div className="meta">{gold.status === 'LIVE' ? `${gold.provider}` : messages.unavailable}</div><div className="kv-grid"><div className="kv"><span className="meta">Bid</span><strong>{formatMoney(gold.bid, locale, country.currency, 2)}</strong></div><div className="kv"><span className="meta">Ask</span><strong>{formatMoney(gold.ask, locale, country.currency, 2)}</strong></div></div></section>
      </div>
      <div className="container section"><div className="section-head"><div><div className="kicker">MARKETS</div><h2>{messages.markets}</h2></div><Link href={`/markets?country=${country.code}&language=${language}`} className="btn">{messages.markets}</Link></div><div className="grid grid-4">{snapshot.markets.length ? snapshot.markets.map((q) => <div className="card" key={q.instrument}><div className="card-title">{q.instrument}</div><div className="metric">{q.spot?.toLocaleString(locale) ?? '—'}</div><div className="meta">{q.status} · {q.currency}</div></div>) : <div className="notice" style={{gridColumn:'1/-1'}}>{messages.noMarkets}</div>}</div></div>
      <div className="container section"><div className="section-head"><div><div className="kicker">POPULAR STOCKS</div><h2>{messages.stocks}</h2></div><Link href={`/stocks?country=${country.code}&language=${language}`} className="btn">{messages.stocks}</Link></div><div className="grid grid-4">{snapshot.stocks.length ? snapshot.stocks.map((q) => <div className="card" key={q.instrument}><div className="card-title">{q.instrument}</div><div className="metric">{q.spot == null ? '—' : q.spot.toLocaleString(locale, { maximumFractionDigits: 2 })}</div><div className="meta">{q.status}</div></div>) : <div className="notice" style={{gridColumn:'1/-1'}}>{messages.noStocks}</div>}</div></div>
    </main><footer className="footer"><div className="container"><div>{countries.length} countries · {languages.length} languages</div><div style={{marginTop:8}}>{messages.referenceFooter}</div></div></footer>
  </div>;
}
