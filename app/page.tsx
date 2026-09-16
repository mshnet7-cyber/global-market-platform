import Link from "next/link";
import { getSnapshot } from "../lib/providers";
import { getPublicAds } from "../lib/public-ads";
import { appConfig, countries, isValidLanguage, languages } from "../lib/config";
import { getDisplayName, getMessages, isRtlLanguage } from "../lib/i18n";

const supportedLanguageCodes = ["ar", "en", "tr", "de"] as const;

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
  const requestedLanguage = params?.language?.toLowerCase() ?? "";
  const language = isValidLanguage(requestedLanguage) && supportedLanguageCodes.includes(requestedLanguage as (typeof supportedLanguageCodes)[number]) ? requestedLanguage : appConfig.defaultLanguage;
  const messages = getMessages(language);
  const [snapshot, ads] = await Promise.all([getSnapshot(country.currency, language, false), getPublicAds({ country: country.code, placement: "banner", limit: 4 })]);
  const gold = snapshot.gold;
  const silver = snapshot.silver;
  const locale = `${language}-${country.code}`;
  const countryName = getDisplayName("region", country.code, language, country.name);
  const supportedLanguages = languages.filter((l) => supportedLanguageCodes.includes(l.code as (typeof supportedLanguageCodes)[number]));

  return <div className="app-shell" lang={language} dir={isRtlLanguage(language) ? "rtl" : "ltr"}>
    <header className="topbar"><div className="container nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="nav-links"><Link href={`/gold?country=${country.code}&language=${language}`}>{messages.gold}</Link><Link href={`/silver?country=${country.code}&language=${language}`}>{messages.silver}</Link><Link href={`/markets?country=${country.code}&language=${language}`}>{messages.markets}</Link><Link href={`/stocks?country=${country.code}&language=${language}`}>{messages.stocks}</Link><Link href={`/currencies?country=${country.code}&language=${language}`}>{language === "ar" ? "العملات" : "Currencies"}</Link><Link href={`/news?country=${country.code}&language=${language}`}>{messages.news}</Link><Link href="/pricing">{language === "ar" ? "الاشتراكات" : "Plans"}</Link></nav><div className="nav-actions"><Link className="btn btn-ghost" href="/login">{messages.login}</Link><Link className="btn btn-primary" href="/demo">{messages.createDisplay}</Link></div></div></header>
    <main>
      {ads.length > 0 && <section className="container section"><div className="kicker">ADVERTISEMENT</div><div className="grid grid-4">{ads.map(ad => <a className="card" href={ad.targetUrl ?? "#"} key={ad.id} target={ad.targetUrl ? "_blank" : undefined} rel={ad.targetUrl ? "noreferrer" : undefined}><div className="card-title">{ad.title}</div>{ad.body && <p className="meta" style={{marginTop:8}}>{ad.body}</p>}<div className="meta" style={{marginTop:10}}>{ad.advertiserName}</div></a>)}</div></section>}
      <div className="container section"><form className="preference-bar" method="get"><label className="label">{messages.country}<select className="select" name="country" defaultValue={country.code}>{countries.map((c) => <option value={c.code} key={c.code}>{getDisplayName("region", c.code, language, c.name)} · {c.currency}</option>)}</select></label><label className="label">{messages.language}<select className="select" name="language" defaultValue={language}>{supportedLanguages.map((l) => <option value={l.code} key={l.code}>{getDisplayName("language", l.code, language, l.name)}</option>)}</select></label><button className="btn" type="submit">{messages.apply}</button></form></div>
      <div className="container hero"><section><div className="kicker">GLOBAL MARKET PLATFORM</div><h1>{language === "ar" ? "الذهب والفضة والأسواق والأخبار، في منصة واحدة." : "Gold, silver, markets and news in one platform."}</h1><p className="lede">{language === "ar" ? "بيانات مرجعية للزوار، مع أدوات تشغيل متكاملة لأصحاب المحلات." : "Public reference data, with integrated operating tools for shop owners."}</p><div className="nav-actions" style={{marginTop:24}}><Link href={`/gold?country=${country.code}&language=${language}`} className="btn btn-primary">{messages.goldView}</Link><Link href={`/markets?country=${country.code}&language=${language}`} className="btn">{language === "ar" ? "الأسواق" : "Markets"}</Link><Link href="/pricing" className="btn">{language === "ar" ? "شاهد الباقات" : "View plans"}</Link></div></section>
        <section className="hero-card"><div className="row"><div><div className="card-title">{messages.gold} — {countryName}</div><div className="metric">24K / Gram</div></div><span className={`pill ${gold.status === 'LIVE' ? 'pill-live' : ''}`}>{gold.status}</span></div><div className="price-xl">{formatMoney(gold.purities["24K"] ?? null, locale, country.currency)}</div><div className="meta">{gold.status === 'LIVE' ? `${gold.provider}` : messages.unavailable}</div><div className="kv-grid"><div className="kv"><span className="meta">{messages.bid}</span><strong>{formatMoney(gold.bid, locale, country.currency, 2)}</strong></div><div className="kv"><span className="meta">{messages.ask}</span><strong>{formatMoney(gold.ask, locale, country.currency, 2)}</strong></div></div></section>
      </div>
      <div className="container section"><div className="section-head"><div><div className="kicker">MARKETS</div><h2>{language === "ar" ? "الأسواق" : "Markets"}</h2></div><Link href={`/markets?country=${country.code}&language=${language}`} className="btn">{language === "ar" ? "عرض الأسواق" : "View markets"}</Link></div><div className="grid grid-4"><Link href={`/markets?country=${country.code}&language=${language}`} className="card"><div className="card-title">{language === "ar" ? "مؤشرات مرجعية" : "Reference indices"}</div><div className="metric">EOD</div><div className="meta">{language === "ar" ? "بيانات نهاية اليوم/متأخرة وفق ترخيص المصدر" : "End-of-day/delayed data subject to source licensing"}</div></Link><Link href={`/stocks?country=${country.code}&language=${language}`} className="card"><div className="card-title">{language === "ar" ? "الأسهم" : "Stocks"}</div><div className="metric">EOD</div><div className="meta">{language === "ar" ? "أسهم عالمية مرجعية عند تفعيل مصدر مرخّص" : "Global reference equities when a licensed source is enabled"}</div></Link><Link href={`/currencies?country=${country.code}&language=${language}`} className="card"><div className="card-title">{language === "ar" ? "العملات" : "Currencies"}</div><div className="metric">FX</div><div className="meta">{language === "ar" ? "أسعار صرف مرجعية" : "Reference exchange rates"}</div></Link><div className="card"><div className="card-title">{messages.gold} &amp; {messages.silver}</div><div className="metric">24K</div><div className="meta">{language === "ar" ? "أسعار المعادن المرجعية" : "Reference metal prices"}</div></div></div></div>
      <div className="container section"><div className="section-head"><div><div className="kicker">NEWS</div><h2>{messages.news}</h2></div><Link href={`/news?country=${country.code}&language=${language}`} className="btn">{language === "ar" ? "كل الأخبار" : "All news"}</Link></div><div className="grid">{snapshot.news.length ? snapshot.news.slice(0, 6).map(item => <article className="card" key={item.id}><strong>{item.title}</strong><div className="meta" style={{marginTop:10}}>{item.source} · {item.status}</div></article>) : <div className="notice">{messages.noNews}</div>}</div></div>
    </main><footer className="footer"><div className="container"><div>{countries.length} countries · {supportedLanguages.length} languages</div><div style={{marginTop:8}}>{messages.referenceFooter}</div></div></footer>
  </div>;
}
