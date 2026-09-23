import Link from "next/link";
import { notFound } from "next/navigation";
import { getSnapshot } from "../../lib/providers";
import type { Quote } from "../../lib/types";
import { appConfig, countries, isValidLanguage, SUPPORTED_PUBLIC_LANGUAGES } from "../../lib/config";
import { getDisplayName, getMessages, isRtlLanguage, formatStatus } from "../../lib/i18n";
import MoneyDisplay from "../../components/MoneyDisplay";

const publicSections = new Set(["gold", "silver", "markets", "stocks", "currencies", "news", "demo"]);

function formatMoney(value: number | null | undefined, locale: string, currency: string, maximumFractionDigits = 2) { return <MoneyDisplay value={value} currency={currency} locale={locale} maximumFractionDigits={maximumFractionDigits} />; }
function formatPercent(value: number | null | undefined, locale: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
}
function QuoteCard({ quote, locale, labels, messages }: { quote: Quote; locale: string; labels: { change: string; percent: string; close: string }; messages: Record<string, string> }) {
  const positive = quote.changePercent != null && quote.changePercent > 0;
  const negative = quote.changePercent != null && quote.changePercent < 0;
  const trendClass = positive ? "quote-card quote-card-up" : negative ? "quote-card quote-card-down" : "quote-card";
  const trendGlyph = positive ? "▲" : negative ? "▼" : "•";
  return <article className={trendClass}><div className="card-top"><div><span className="muted">{quote.exchange ?? "GLOBAL"}</span><div className="quote-symbol">{quote.instrument}</div></div><span className="status">{formatStatus(quote.status, messages)}</span></div><div className="quote-price"><span aria-hidden="true" className="quote-trend">{trendGlyph}</span> {formatMoney(quote.spot, locale, quote.currency)}</div><div className="quote-metrics"><div><span>{labels.change}</span><b className={positive ? "quote-positive" : negative ? "quote-negative" : ""}>{formatMoney(quote.change, locale, quote.currency)}</b></div><div><span>{labels.percent}</span><b className={positive ? "quote-positive" : negative ? "quote-negative" : ""}>{formatPercent(quote.changePercent, locale)}</b></div><div><span>{labels.close}</span><b>{formatMoney(quote.previousClose, locale, quote.currency)}</b></div></div><div className="data-foot">{quote.provider || messages.unavailable} · {quote.timestamp ? new Date(quote.timestamp).toLocaleString(locale) : "—"}</div></article>;
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams?: Promise<{ country?: string; language?: string }> }) {
  const { section } = await params;
  if (!publicSections.has(section)) notFound();
  const query = await searchParams;
  const requestedLanguage = query?.language?.toLowerCase() ?? "";
  const language = isValidLanguage(requestedLanguage) && SUPPORTED_PUBLIC_LANGUAGES.includes(requestedLanguage as (typeof SUPPORTED_PUBLIC_LANGUAGES)[number]) ? requestedLanguage : appConfig.defaultLanguage;
  const country = countries.find((c) => c.code === query?.country?.toUpperCase()) ?? countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const messages = getMessages(language);
  const title = messages[section] ?? section;
  const includePublicMarkets = section === "markets" || section === "stocks";
  const snapshot = await getSnapshot(country.currency, language, section === "demo", includePublicMarkets);
  const metal = section === "silver" ? snapshot.silver : snapshot.gold;
  const isRtl = isRtlLanguage(language);
  const locale = `${language}-${country.code}`;
  const countryName = getDisplayName("region", country.code, language, country.name);
  const quotes = section === "markets" ? snapshot.markets : section === "stocks" ? snapshot.stocks : snapshot.currencies;
  const quoteLabels = { change: messages.change, percent: messages.percent, close: messages.close };
  const sectionDescription = section === "gold" ? (language === "ar" ? "سعر مرجعي للذهب مع تفاصيل السوق الأساسية." : "Reference gold pricing with core market details.") : section === "silver" ? (language === "ar" ? "بيانات مرجعية للفضة للمتابعة اليومية." : "Reference silver data for daily monitoring.") : section === "markets" ? (language === "ar" ? "مؤشرات وأسواق مرجعية في بطاقات واضحة وسريعة القراءة." : "Reference markets and indices in a clear, quick-reading view.") : section === "stocks" ? (language === "ar" ? "أسهم مرجعية عند توفر مصدر بيانات مرخّص." : "Reference equities when a licensed data source is enabled.") : section === "news" ? (language === "ar" ? "موجز الأخبار المتاحة من مصادر البيانات المفعّلة." : "Available news from enabled data sources.") : messages.demoPreview;

  return <div className={`page-frame section-page section-${section}`} dir={isRtl ? "rtl" : "ltr"} lang={language}>
    <header className="topbar"><div className="container nav site-nav"><Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link><nav className="nav-links" aria-label="Primary"><Link href={`/gold?country=${country.code}&language=${language}`}>{messages.gold}</Link><Link href={`/silver?country=${country.code}&language=${language}`}>{messages.silver}</Link><Link href={`/markets?country=${country.code}&language=${language}`}>{messages.markets}</Link><Link href={`/stocks?country=${country.code}&language=${language}`}>{messages.stocks}</Link><Link href={`/currencies?country=${country.code}&language=${language}`}>{messages.currencies}</Link><Link href={`/news?country=${country.code}&language=${language}`}>{messages.news}</Link></nav><div className="nav-actions"><div className="nav-preferences"><span className="country-dot" />{countryName}</div><Link href="/login" className="btn btn-ghost">{messages.login}</Link><Link href="/demo" className="btn btn-primary">{messages.createDisplay}</Link></div></div></header>
    <main className="container site-main section-shell"><section className="page-hero"><div className="section-header"><div><div className="eyebrow"><span className="live-dot" />{section.toUpperCase()} · {countryName}</div><h1>{title}</h1></div><div className="meta-block">{sectionDescription}<br />{messages.referenceOnly}</div></div></section>
      {(section === "markets" || section === "stocks" || section === "currencies") && <>{quotes.length === 0 ? <div className="empty-premium">{messages.unavailable}</div> : <div className="quote-grid">{quotes.map((quote) => <QuoteCard key={`${quote.exchange ?? ""}:${quote.symbol ?? quote.instrument}`} quote={quote} locale={locale} labels={quoteLabels} messages={messages} />)}</div>}</>}
      {(section === "gold" || section === "silver") && <section className="hero-panel"><div className="card-top"><div><div className="micro-label">{countryName}</div><div className="quote-symbol">{metal.instrument}</div></div><span className="status">{formatStatus(metal.status, messages)}</span></div><div className="panel-value">{formatMoney(metal.perGram24k, locale, country.currency, 3)} <small style={{fontSize:12,color:"#74858f",fontWeight:700}}>/ {messages.gram}</small></div><div className="panel-meta">{messages.referenceOnly}</div><div className="quote-metrics" style={{marginTop:22}}><div><span>{messages.spot}</span><b>{formatMoney(metal.spot, locale, country.currency)}</b></div><div><span>{messages.bid}</span><b>{formatMoney(metal.bid, locale, country.currency)}</b></div><div><span>{messages.ask}</span><b>{formatMoney(metal.ask, locale, country.currency)}</b></div></div></section>}
      {section === "news" && <div className="news-grid">{snapshot.news.length === 0 ? <div className="empty-premium">{messages.noNews}</div> : snapshot.news.map(item => <article className="news-card" key={item.id}><a href={item.url} target="_blank" rel="noreferrer" style={{color:"inherit",textDecoration:"none"}}><strong>{item.title}</strong><div className="meta">{item.source} · {formatStatus(item.status, messages)}</div></a></article>)}</div>}
      {section === "demo" && <div className="display-preview"><div className="eyebrow">DISPLAY PREVIEW</div><h2>{language === "ar" ? "واجهة شاشة السوق" : "Market display preview"}</h2><p>{messages.demoPreview}</p><div className="actions" style={{marginTop:20}}><Link href="/pricing" className="btn btn-primary">{messages.plans}</Link><Link href="/login" className="btn">{messages.login}</Link></div></div>}
    </main><footer className="footer-premium"><div className="container footer-bottom"><span>© Global Market</span><span>{messages.referenceFooter}</span></div></footer>
  </div>;
}
