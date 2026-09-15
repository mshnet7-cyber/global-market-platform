import Link from "next/link";
import { getSnapshot } from "../../lib/providers";
import { countries } from "../../lib/config";

const titles: Record<string, string> = {
  gold: "الذهب",
  silver: "الفضة",
  markets: "الأسواق",
  stocks: "الأسهم",
  news: "الأخبار",
  demo: "معاينة شاشة الأسعار",
  login: "تسجيل الدخول",
  signup: "إنشاء الحساب",
};

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const title = titles[section];

  if (!title) {
    return (
      <main className="wrap section">
        <h1>404</h1>
        <p className="hero-copy">الصفحة غير موجودة.</p>
        <Link className="btn primary" href="/">العودة للرئيسية</Link>
      </main>
    );
  }

  const country = countries[0];
  const snapshot = await getSnapshot(country.currency, "ar", section === "demo");
  const metal = section === "silver" ? snapshot.silver : snapshot.gold;

  return (
    <div>
      <header className="topbar">
        <div className="wrap nav">
          <Link href="/" className="brand">GLOBAL <span>MARKET</span></Link>
          <nav className="links">
            <Link href="/gold">Gold</Link>
            <Link href="/silver">Silver</Link>
            <Link href="/markets">Markets</Link>
            <Link href="/stocks">Stocks</Link>
            <Link href="/news">News</Link>
          </nav>
          <div className="actions">
            <Link href="/login" className="btn ghost">تسجيل الدخول</Link>
            <Link href="/demo" className="btn primary">أنشئ شاشة</Link>
          </div>
        </div>
      </header>

      <main className="wrap section">
        <div className="eyebrow">{section.toUpperCase()}</div>
        <h1>{title}</h1>

        {(section === "gold" || section === "silver") && (
          <section className="gold-card">
            <div className="card-top">
              <div>
                <span className="muted">{country.name}</span>
                <strong>{metal.instrument}</strong>
              </div>
              <span className="status">{metal.status}</span>
            </div>
            <div className="price">
              {metal.perGram24k == null ? "—" : `${metal.perGram24k.toFixed(3)} ${country.currency}`}
              <small> / gram</small>
            </div>
            <div className="subline">السعر مرجعي وليس سعر شراء أو بيع للمحل.</div>
            <div className="mini-grid">
              <div><span>Spot</span><b>{metal.spot == null ? "—" : metal.spot.toFixed(2)}</b></div>
              <div><span>Bid</span><b>{metal.bid == null ? "—" : metal.bid.toFixed(2)}</b></div>
              <div><span>Ask</span><b>{metal.ask == null ? "—" : metal.ask.toFixed(2)}</b></div>
            </div>
          </section>
        )}

        {section === "markets" && (
          <div className="grid four">
            {snapshot.markets.length === 0 ? (
              <div className="notice">بيانات الأسواق الحية غير مفعلة حاليًا.</div>
            ) : (
              snapshot.markets.map((q) => (
                <div className="card" key={q.instrument}>
                  <span className="muted">{q.instrument}</span>
                  <strong className="metric">{q.spot ?? "—"}</strong>
                  <span className="muted">{q.status}</span>
                </div>
              ))
            )}
          </div>
        )}

        {section === "stocks" && (
          <div className="grid four">
            {snapshot.stocks.length === 0 ? (
              <div className="notice">مصدر الأسهم التجاري غير مفعّل حاليًا.</div>
            ) : (
              snapshot.stocks.map((q) => (
                <div className="card" key={q.instrument}>
                  <span className="muted">{q.instrument}</span>
                  <strong className="metric">{q.spot ?? "—"}</strong>
                  <span className="muted">{q.status}</span>
                </div>
              ))
            )}
          </div>
        )}

        {section === "news" && (
          <div className="grid">
            {snapshot.news.length === 0 ? (
              <div className="notice">لا يوجد مصدر أخبار خارجي مفعّل حاليًا.</div>
            ) : (
              snapshot.news.map((item) => (
                <article className="card" key={item.id}>
                  <strong>{item.title}</strong>
                  <div className="muted" style={{ marginTop: 10 }}>{item.source} · {item.status}</div>
                </article>
              ))
            )}
          </div>
        )}

        {(section === "demo" || section === "login" || section === "signup") && (
          <div className="card">
            <div className="notice">
              هذه الصفحة تعمل الآن ضمن مسارات المنصة. الوظيفة الكاملة للحسابات والاشتراكات والشاشات ستُوصل في المرحلة التالية.
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="wrap">المعلومات مرجعية وليست خدمة وساطة أو استشارة استثمارية.</div>
      </footer>
    </div>
  );
}
