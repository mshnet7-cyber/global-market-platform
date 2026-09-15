import Link from "next/link";

const metals = [
  ["24K", 43.21],
  ["22K", 39.61],
  ["21K", 37.81],
  ["18K", 32.41],
];

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <div className="nav wrap">
          <Link href="/" className="brand">GLOBAL <span>MARKET</span></Link>
          <nav className="links"><Link href="/gold">Gold</Link><Link href="/silver">Silver</Link><Link href="/markets">Markets</Link><Link href="/stocks">Stocks</Link><Link href="/news">News</Link></nav>
          <div className="actions"><Link href="/login" className="btn ghost">تسجيل الدخول</Link><Link href="/demo" className="btn primary">أنشئ شاشة</Link></div>
        </div>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow">GLOBAL MARKET REFERENCE</div>
          <h1>أسعار وأسواق العالم، في منصة واحدة.</h1>
          <p>ذهب وفضة وأسواق وأسهم وأخبار مالية، مع العملة المحلية وحالة البيانات بوضوح.</p>
          <div className="actions"><Link href="/gold" className="btn primary">شاهد الذهب</Link><Link href="/demo" className="btn ghost">جرّب شاشة المحل</Link></div>
        </div>
        <div className="gold-card">
          <div className="card-top"><div><span className="muted">الذهب · مرجع عالمي</span><strong>24K / Gram</strong></div><span className="status">DEMO</span></div>
          <div className="price">43.210 <small>OMR</small></div>
          <div className="subline">بيانات العرض التجريبي — لا تمثل سعرًا حيًا</div>
          <div className="mini-grid"><div><span>Spot</span><b>$4,020.00</b></div><div><span>Bid</span><b>—</b></div><div><span>Ask</span><b>—</b></div></div>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head"><div><div className="eyebrow">GOLD</div><h2>درجات الذهب</h2></div><Link href="/gold" className="text-link">التفاصيل</Link></div>
        <div className="grid four">{metals.map(([k, v]) => <div className="card" key={k}><span className="muted">{k}</span><strong className="metric">{v.toFixed(3)} OMR</strong><span className="muted">لكل غرام · تجريبي</span></div>)}</div>
      </section>

      <section className="wrap section two-col">
        <div className="card"><div className="eyebrow">MARKETS</div><h2>الأسواق الرئيسية</h2><div className="notice">البيانات الحية للسوق ستُفعّل فقط عند وجود مصدر يسمح بالعرض الخارجي التجاري.</div></div>
        <div className="card"><div className="eyebrow">NEWS</div><h2>أهم الأخبار</h2><div className="notice">محرك الأخبار يدعم مصادر متعددة، إزالة التكرار، التحقق من الحداثة، وأولوية الدولة واللغة.</div></div>
      </section>

      <section className="wrap section"><div className="card display-promo"><div><div className="eyebrow">DIGITAL DISPLAY</div><h2>شاشة أسعار احترافية لمحلات الذهب</h2><p>تشغيل على التلفاز أو الكمبيوتر أو الجهاز اللوحي، مع ربط آمن وإمكانية إدارة عدة شاشات.</p></div><Link href="/demo" className="btn primary">ابدأ بالمعاينة</Link></div></section>

      <footer className="footer"><div className="wrap">المعلومات مرجعية وليست خدمة وساطة أو استشارة استثمارية. العلامة التجارية والدومين التجاري لم يُحسما بعد.</div></footer>
    </main>
  );
}
