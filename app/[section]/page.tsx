import Link from "next/link";
import { getSnapshot } from "../../lib/providers";
import { appConfig, countries, isValidLanguage, languages } from "../../lib/config";
import { getDisplayName, getMessages, isRtlLanguage } from "../../lib/i18n";

const publicSections = new Set(["gold", "silver", "news", "demo"]);

function formatMoney(value: number | null, locale: string, currency: string, maximumFractionDigits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits }).format(value);
  } catch {
    return `${value.toLocaleString(locale, { maximumFractionDigits })} ${currency}`;
  }
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams?: Promise<{ country?: string; language?: string }> }) {
  const { section } = await params;
  if (!publicSections.has(section)) {
    return <main className="wrap section"><h1>404</h1><p className="hero-copy">Page not found.</p><Link className="btn primary" href="/">Home</Link></main>;
  }

  const query = await searchParams;
  const language = query?.language && isValidLanguage(query.language) ? query.language.toLowerCase() : appConfig.defaultLanguage;
  const country = countries.find((c) => c.code === query?.country?.toUpperCase()) ?? countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const messages = getMessages(language);
  const title = messages[section];
  const snapshot = await getSnapshot(country.currency, language, section === "demo");
  const metal = section === "silver" ? snapshot.silver : snapshot.gold;
  const isRtl = isRtlLanguage(language);
  const locale = `${language}-${country.code}`;
  const countryName = getDisplayName("region", country.code, language, country.name);

  return <div dir={isRtl ? "rtl" : "ltr"} lang={language}>
    <header className="topbar"><div className="wrap nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="links"><Link href={`/gold?country=${country.code}&language=${language}`}>{messages.gold}</Link><Link href={`/silver?country=${country.code}&language=${language}`}>{messages.silver}</Link><Link href={`/news?country=${country.code}&language=${language}`}>{messages.news}</Link><Link href="/pricing">{language === "ar" ? "الاشتراكات" : "Plans"}</Link></nav><div className="actions"><Link href="/login" className="btn ghost">{messages.login}</Link><Link href="/demo" className="btn primary">{messages.createDisplay}</Link></div></div></header>
    <main className="wrap section"><div className="eyebrow">{section.toUpperCase()}</div><h1>{title}</h1>
      {(section === "gold" || section === "silver") && <section className="gold-card"><div className="card-top"><div><span className="muted">{countryName}</span><strong>{metal.instrument}</strong></div><span className="status">{metal.status}</span></div><div className="price">{formatMoney(metal.perGram24k, locale, country.currency, 3)}<small> / gram</small></div><div className="subline">{messages.referenceOnly}</div><div className="mini-grid"><div><span>Spot</span><b>{formatMoney(metal.spot, locale, country.currency)}</b></div><div><span>{messages.bid}</span><b>{formatMoney(metal.bid, locale, country.currency)}</b></div><div><span>{messages.ask}</span><b>{formatMoney(metal.ask, locale, country.currency)}</b></div></div></section>}
      {section === "news" && <div className="grid">{snapshot.news.length === 0 ? <div className="notice">{messages.noNews}</div> : snapshot.news.map(item => <article className="card" key={item.id}><strong>{item.title}</strong><div className="muted" style={{ marginTop: 10 }}>{item.source} · {item.status}</div></article>)}</div>}
      {section === "demo" && <div className="card"><div className="notice">{language === "ar" ? "معاينة شاشة المحل — اربط الشاشة من حساب التاجر بعد الاشتراك." : "Shop display preview — connect the display from the merchant account after subscription."}</div></div>}
    </main><footer className="footer"><div className="wrap">{messages.referenceFooter}</div></footer>
  </div>;
}
