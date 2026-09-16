import Link from "next/link";
import { notFound } from "next/navigation";
import { getSnapshot } from "../../lib/providers";
import type { Quote } from "../../lib/types";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import { getDisplayName, getMessages, isRtlLanguage, formatStatus } from "../../lib/i18n";

const publicSections = new Set(["gold", "silver", "markets", "stocks", "news", "demo"]);

function formatMoney(value: number | null | undefined, locale: string, currency: string, maximumFractionDigits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits }).format(value);
  } catch {
    return `${value.toLocaleString(locale, { maximumFractionDigits })} ${currency}`;
  }
}

function formatPercent(value: number | null | undefined, locale: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
}

function QuoteCard({ quote, locale, labels }: { quote: Quote; locale: string; labels: { change: string; percent: string; close: string } }) {
  const positive = quote.changePercent != null && quote.changePercent > 0;
  const negative = quote.changePercent != null && quote.changePercent < 0;
  const trendClass = positive ? "quote-card quote-card-up" : negative ? "quote-card quote-card-down" : "quote-card";
  const trendGlyph = positive ? "▲" : negative ? "▼" : "•";
  return <article className={trendClass}>
    <div className="card-top">
      <div><span className="muted">{quote.exchange ?? ""}</span><strong>{quote.instrument}</strong></div>
      <span className="status">{quote.status}</span>
    </div>
    <div className="price"><span aria-hidden="true" className="quote-trend">{trendGlyph}</span> {formatMoney(quote.spot, locale, quote.currency)}</div>
    <div className="mini-grid">
      <div><span>{labels.change}</span><b className={positive ? "quote-positive" : negative ? "quote-negative" : ""}>{formatMoney(quote.change, locale, quote.currency)}</b></div>
      <div><span>{labels.percent}</span><b className={positive ? "quote-positive" : negative ? "quote-negative" : ""}>{formatPercent(quote.changePercent, locale)}</b></div>
      <div><span>{labels.close}</span><b>{formatMoney(quote.previousClose, locale, quote.currency)}</b></div>
    </div>
    <div className="muted" style={{ marginTop: 12 }}>{quote.provider} · {quote.timestamp ? new Date(quote.timestamp).toLocaleString(locale) : "—"}</div>
  </article>;
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams?: Promise<{ country?: string; language?: string }> }) {
  const { section } = await params;
  if (!publicSections.has(section)) notFound();

  const query = await searchParams;
  const language = query?.language && isValidLanguage(query.language) ? query.language.toLowerCase() : appConfig.defaultLanguage;
  const country = countries.find((c) => c.code === query?.country?.toUpperCase()) ?? countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const messages = getMessages(language);
  const title = messages[section] ?? section;
  const includePublicMarkets = section === "markets" || section === "stocks";
  const snapshot = await getSnapshot(country.currency, language, section === "demo", includePublicMarkets);
  const metal = section === "silver" ? snapshot.silver : snapshot.gold;
  const isRtl = isRtlLanguage(language);
  const locale = `${language}-${country.code}`;
  const countryName = getDisplayName("region", country.code, language, country.name);
  const quotes = section === "markets" ? snapshot.markets : snapshot.stocks;
  const quoteLabels = language === "ar"
    ? { change: "التغير", percent: "النسبة", close: "الإغلاق" }
    : language === "tr"
      ? { change: "Değişim", percent: "Yüzde", close: "Kapanış" }
      : language === "de"
        ? { change: "Änderung", percent: "Prozent", close: "Schluss" }
        : { change: "Change", percent: "%", close: "Close" };

  return <div dir={isRtl ? "rtl" : "ltr"} lang={language}>
    <header className="topbar"><div className="wrap nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="links"><Link href={`/gold?country=${country.code}&language=${language}`}>{messages.gold}</Link><Link href={`/silver?country=${country.code}&language=${language}`}>{messages.silver}</Link><Link href={`/markets?country=${country.code}&language=${language}`}>{messages.markets}</Link><Link href={`/stocks?country=${country.code}&language=${language}`}>{messages.stocks}</Link><Link href={`/news?country=${country.code}&language=${language}`}>{messages.news}</Link><Link href="/pricing">{language === "ar" ? "الاشتراكات" : "Plans"}</Link></nav><div className="actions"><Link href="/login" className="btn ghost">{messages.login}</Link><Link href="/demo" className="btn primary">{messages.createDisplay}</Link></div></div></header>
    <main className="wrap section">
      <div className="eyebrow">{section.toUpperCase()}</div><h1>{title}</h1>
      {(section === "markets" || section === "stocks") && <>
        <p className="muted">{messages.marketDataNote}</p>
        {quotes.length === 0 ? <div className="notice" style={{ marginTop: 18 }}>{messages.unavailable}</div> : <div className="grid" style={{ marginTop: 18 }}>{quotes.map((quote) => <QuoteCard key={`${quote.exchange ?? ""}:${quote.symbol ?? quote.instrument}`} quote={quote} locale={locale} labels={quoteLabels} />)}</div>}
      </>}
      {(section === "gold" || section === "silver") && <section className="gold-card"><div className="card-top"><div><span className="muted">{countryName}</span><strong>{metal.instrument}</strong></div><span className="status">{formatStatus(metal.status, messages)}</span></div><div className="price">{formatMoney(metal.perGram24k, locale, country.currency, 3)}<small> / {messages.gram}</small></div><div className="subline">{messages.referenceOnly}</div><div className="mini-grid"><div><span>{messages.spot}</span><b>{formatMoney(metal.spot, locale, country.currency)}</b></div><div><span>{messages.bid}</span><b>{formatMoney(metal.bid, locale, country.currency)}</b></div><div><span>{messages.ask}</span><b>{formatMoney(metal.ask, locale, country.currency)}</b></div></div></section>}
      {section === "news" && <div className="grid">{snapshot.news.length === 0 ? <div className="notice">{messages.noNews}</div> : snapshot.news.map(item => <article className="card" key={item.id}><strong>{item.title}</strong><div className="muted" style={{ marginTop: 10 }}>{item.source} · {formatStatus(item.status, messages)}</div></article>)}</div>}
      {section === "demo" && <div className="card"><div className="notice">{language === "ar" ? "معاينة شاشة المحل — اربط الشاشة من حساب التاجر بعد الاشتراك." : "Shop display preview — connect the display from the merchant account after subscription."}</div></div>}
    </main><footer className="footer"><div className="wrap">{messages.referenceFooter}</div></footer>
  </div>;
}
