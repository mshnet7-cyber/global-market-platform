import Link from "next/link";
import { getSnapshot } from "../../lib/providers";
import { appConfig, countries, isValidLanguage, languages } from "../../lib/config";

const titles: Record<string, Record<string, string>> = {
  ar: { gold: "الذهب", silver: "الفضة", markets: "الأسواق", stocks: "الأسهم", news: "الأخبار", demo: "معاينة شاشة الأسعار", login: "تسجيل الدخول", signup: "إنشاء الحساب" },
  en: { gold: "Gold", silver: "Silver", markets: "Markets", stocks: "Stocks", news: "News", demo: "Display Preview", login: "Login", signup: "Create account" },
  tr: { gold: "Altın", silver: "Gümüş", markets: "Piyasalar", stocks: "Hisseler", news: "Haberler", demo: "Ekran Önizleme", login: "Giriş", signup: "Hesap oluştur" },
  de: { gold: "Gold", silver: "Silber", markets: "Märkte", stocks: "Aktien", news: "Nachrichten", demo: "Display-Vorschau", login: "Anmelden", signup: "Konto erstellen" },
};

function labels(language: string) {
  return titles[language] ?? titles.en;
}

export default async function SectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams?: Promise<{ country?: string; language?: string }> }) {
  const { section } = await params;
  const query = await searchParams;
  const language = query?.language && isValidLanguage(query.language) ? query.language.toLowerCase() : appConfig.defaultLanguage;
  const country = countries.find((c) => c.code === query?.country) ?? countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const title = labels(language)[section];
  if (!title) return <main className="wrap section"><h1>404</h1><p className="hero-copy">Page not found.</p><Link className="btn primary" href="/">Home</Link></main>;

  const snapshot = await getSnapshot(country.currency, language, section === "demo");
  const metal = section === "silver" ? snapshot.silver : snapshot.gold;
  const isRtl = language === "ar" || language === "fa" || language === "ur" || language === "he";

  return <div dir={isRtl ? "rtl" : "ltr"} lang={language}>
    <header className="topbar"><div className="wrap nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="links"><Link href={`/gold?country=${country.code}&language=${language}`}>Gold</Link><Link href={`/silver?country=${country.code}&language=${language}`}>Silver</Link><Link href={`/markets?country=${country.code}&language=${language}`}>Markets</Link><Link href={`/stocks?country=${country.code}&language=${language}`}>Stocks</Link><Link href={`/news?country=${country.code}&language=${language}`}>News</Link></nav><div className="actions"><Link href="/login" className="btn ghost">Login</Link><Link href="/demo" className="btn primary">Create Display</Link></div></div></header>
    <main className="wrap section"><div className="eyebrow">{section.toUpperCase()}</div><h1>{title}</h1>
      {(section === "gold" || section === "silver") && <section className="gold-card"><div className="card-top"><div><span className="muted">{country.name}</span><strong>{metal.instrument}</strong></div><span className="status">{metal.status}</span></div><div className="price">{metal.perGram24k == null ? "—" : `${metal.perGram24k.toFixed(3)} ${country.currency}`}<small> / gram</small></div><div className="subline">Reference price only — not a shop buy/sell price.</div><div className="mini-grid"><div><span>Spot</span><b>{metal.spot == null ? "—" : metal.spot.toFixed(2)}</b></div><div><span>Bid</span><b>{metal.bid == null ? "—" : metal.bid.toFixed(2)}</b></div><div><span>Ask</span><b>{metal.ask == null ? "—" : metal.ask.toFixed(2)}</b></div></div></section>}
      {section === "markets" && <div className="grid four">{snapshot.markets.length === 0 ? <div className="notice">No live market source is enabled in this environment.</div> : snapshot.markets.map(q => <div className="card" key={q.instrument}><span className="muted">{q.instrument}</span><strong className="metric">{q.spot ?? "—"}</strong><span className="muted">{q.status}</span></div>)}</div>}
      {section === "stocks" && <div className="grid four">{snapshot.stocks.length === 0 ? <div className="notice">No externally permitted commercial stock source is enabled.</div> : snapshot.stocks.map(q => <div className="card" key={q.instrument}><span className="muted">{q.instrument}</span><strong className="metric">{q.spot ?? "—"}</strong><span className="muted">{q.status}</span></div>)}</div>}
      {section === "news" && <div className="grid">{snapshot.news.length === 0 ? <div className="notice">No external news source is enabled.</div> : snapshot.news.map(item => <article className="card" key={item.id}><strong>{item.title}</strong><div className="muted" style={{ marginTop: 10 }}>{item.source} · {item.status}</div></article>)}</div>}
      {(section === "demo" || section === "login" || section === "signup") && <div className="card"><div className="notice">This route is connected to the platform. Dedicated authentication, billing, and display management use their own secured routes.</div></div>}
    </main><footer className="footer"><div className="wrap">Reference information only. Not brokerage or investment advice.</div></footer>
  </div>;
}
