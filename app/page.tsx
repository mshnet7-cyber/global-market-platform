import Link from "next/link";
import { getSnapshot } from "../lib/providers";
import { appConfig, countries, isValidLanguage, languages } from "../lib/config";

export default async function Home({ searchParams }: { searchParams?: Promise<{ country?: string; language?: string }> }) {
  const params = await searchParams;
  const country = countries.find((c) => c.code === params?.country) ?? countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const language = params?.language && isValidLanguage(params.language) ? params.language.toLowerCase() : appConfig.defaultLanguage;
  const snapshot = await getSnapshot(country.currency, language, false);
  const gold = snapshot.gold;
  const locale = `${language}-${country.code}`;
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency: country.currency, maximumFractionDigits: 3 });
  const displayGold = gold.purities["24K"] == null ? "—" : formatter.format(gold.purities["24K"]);
  const rtl = ["ar", "fa", "ur", "he"].includes(language);

  return (
    <div className="app-shell" lang={language} dir={rtl ? "rtl" : "ltr"}>
      <header className="topbar">
        <div className="container nav">
          <Link href="/" className="brand">GLOBAL <span>MARKET</span></Link>
          <nav className="nav-links">
            <Link href={`/gold?country=${country.code}&language=${language}`}>Gold</Link>
            <Link href={`/silver?country=${country.code}&language=${language}`}>Silver</Link>
            <Link href={`/markets?country=${country.code}&language=${language}`}>Markets</Link>
            <Link href={`/stocks?country=${country.code}&language=${language}`}>Stocks</Link>
            <Link href={`/news?country=${country.code}&language=${language}`}>News</Link>
          </nav>
          <div className="nav-actions">
            <Link className="btn btn-ghost" href="/login">تسجيل الدخول</Link>
            <Link className="btn btn-primary" href="/demo">أنشئ شاشة</Link>
          </div>
        </div>
      </header>

      <main>
        <div className="container section">
          <form className="preference-bar" method="get">
            <label className="label">
              الدولة
              <select className="select" name="country" defaultValue={country.code}>
                {countries.map((c) => <option value={c.code} key={c.code}>{c.name} · {c.currency}</option>)}
              </select>
            </label>
            <label className="label">
              Language
              <select className="select" name="language" defaultValue={language}>
                {languages.map((l) => <option value={l.code} key={l.code}>{l.name}</option>)}
              </select>
            </label>
            <button className="btn" type="submit">تطبيق</button>
          </form>
        </div>

        <div className="container hero">
          <section>
            <div className="kicker">GLOBAL MARKET REFERENCE</div>
            <h1>أسعار وأسواق العالم، في منصة واحدة.</h1>
            <p className="lede">ذهب وفضة وأسواق وأسهم وأخبار مالية، مع دولة ولغة وعملة قابلة للتغيير بشكل مستقل.</p>
            <div className="nav-actions" style={{ marginTop: 24 }}>
              <Link href={`/gold?country=${country.code}&language=${language}`} className="btn btn-primary">شاهد الذهب</Link>
              <Link href="/demo" className="btn">جرّب شاشة المحل</Link>
            </div>
          </section>

          <section className="hero-card">
            <div className="row">
              <div>
                <div className="card-title">الذهب — {country.name}</div>
                <div className="metric">24K / Gram</div>
              </div>
              <span className={`pill ${gold.status === "LIVE" ? "pill-live" : ""}`}>{gold.status}</span>
            </div>
            <div className="price-xl">{displayGold}</div>
            <div className="meta">{gold.status === "LIVE" ? `مصدر: ${gold.provider}` : "لا توجد بيانات حية مفعلة حاليًا"}</div>
            <div className="kv-grid">
              <div className="kv"><span className="meta">Bid</span><strong>{gold.bid == null ? "—" : formatter.format(gold.bid)}</strong></div>
              <div className="kv"><span className="meta">Ask</span><strong>{gold.ask == null ? "—" : formatter.format(gold.ask)}</strong></div>
            </div>
          </section>
        </div>

        <div className="container section">
          <div className="section-head">
            <div><div className="kicker">MARKETS</div><h2>الأسواق الرئيسية</h2></div>
            <Link href={`/markets?country=${country.code}&language=${language}`} className="btn">كل الأسواق</Link>
          </div>
          <div className="grid grid-4">
            {snapshot.markets.length ? snapshot.markets.map((q) => (
              <div className="card" key={q.instrument}>
                <div className="card-title">{q.instrument}</div>
                <div className="metric">{q.spot?.toLocaleString(locale) ?? "—"}</div>
                <div className="meta">{q.status} · {q.currency}</div>
              </div>
            )) : <div className="notice" style={{ gridColumn: "1/-1" }}>بيانات المؤشرات الحية غير مفعلة حاليًا.</div>}
          </div>
        </div>

        <div className="container section">
          <div className="section-head">
            <div><div className="kicker">POPULAR STOCKS</div><h2>الأسهم الرئيسية</h2></div>
            <Link href={`/stocks?country=${country.code}&language=${language}`} className="btn">بحث الأسهم</Link>
          </div>
          <div className="grid grid-4">
            {snapshot.stocks.length ? snapshot.stocks.map((q) => (
              <div className="card" key={q.instrument}>
                <div className="card-title">{q.instrument}</div>
                <div className="metric">{q.spot == null ? "—" : q.spot.toLocaleString(locale, { maximumFractionDigits: 2 })}</div>
                <div className="meta">{q.status}</div>
              </div>
            )) : <div className="notice" style={{ gridColumn: "1/-1" }}>مصدر الأسهم التجاري/المسموح للعرض الخارجي غير مفعّل حاليًا.</div>}
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div>الدول: {countries.length} · اللغات: {languages.length}</div>
          <div style={{ marginTop: 8 }}>المعلومات مرجعية وليست خدمة وساطة أو استشارة استثمارية.</div>
        </div>
      </footer>
    </div>
  );
}
