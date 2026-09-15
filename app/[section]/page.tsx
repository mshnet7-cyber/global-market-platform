import Link from "next/link";
import { getSnapshot } from "../../lib/providers";
import { countries } from "../../lib/config";

const labels: Record<string, { title: string; kicker: string; description: string }> = {
  gold: { title: "الذهب", kicker: "GOLD", description: "أسعار الذهب المرجعية، مع سعر الأونصة والغرام ودرجات النقاء." },
  silver: { title: "الفضة", kicker: "SILVER", description: "أسعار الفضة المرجعية ومعلومات السوق الحالية عندما يتوفر مصدر صالح للعرض." },
  markets: { title: "الأسواق", kicker: "MARKETS", description: "مؤشرات الأسواق العالمية وحالتها دون عرض بيانات تجريبية على أنها حية." },
  stocks: { title: "الأسهم", kicker: "STOCKS", description: "الأسهم والمعلومات السوقية المسموح بعرضها خارجيًا." },
  news: { title: "الأخبار", kicker: "NEWS", description: "أخبار مالية مرتبة حسب الحداثة والأهمية والثقة ومصادر متعددة." },
  demo: { title: "معاينة شاشة الأسعار", kicker: "DIGITAL DISPLAY", description: "أنشئ معاينة لشاشة أسعار المحل واختر التصميم والحجم قبل التسجيل." },
  login: { title: "تسجيل الدخول", kicker: "ACCOUNT", description: "منطقة الحساب ستُفعّل عبر المصادقة الآمنة في المرحلة التالية." },
  signup: { title: "إنشاء الحساب", kicker: "ACCOUNT", description: "إنشاء الحساب وإضافة المتجر والاشتراك من خلال التدفق الآمن." },
};

export default async function SectionPage({ params, searchParams }: {
  params: Promise<{ section: string }>;
  searchParams?: Promise<{ country?: string; language?: string }>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const page = labels[section];
  if (!page) {
    return <main className="wrap section"><h1>404</h1><p>الصفحة غير موجودة.</p><Link className="btn primary" href="/">العودة للرئيسية</Link></main>;
  }

  const country = countries.find((c) => c.code === query?.country) ?? countries[0];
  const language = query?.language ?? "ar";
  const snapshot = await getSnapshot(country.currency, language, section === "demo");
  const metal = section === "silver" ? snapshot.silver : snapshot.gold;

  return (
    <div>
      <header className="topbar"><div className="wrap nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="links"><Link href="/gold">Gold</Link><Link href="/silver">Silver</Link><Link href="/markets">Markets</Link><Link href="/stocks">Stocks</Link><Link href="/news">News</Link></nav><div className="actions"><Link href="/login" className="btn ghost">تسجيل الدخول</Link><Link href="/demo" className="btn primary">أنشئ شاشة</Link></div></div></header>
      <main className="wrap section">
        <div className="eyebrow">{page.kicker}</div>
        <h1>{page.title}</h1>
        <p className="hero-copy">{page.description}</p>

        {(section === "gold" || section === "silver") && (
          <section className="gold-card">
            <div className="card-top"><div><span className="muted">{section === "gold" ? "Gold" : "Silver"} · {country.name}</span><strong>{metal.instrument}</strong></div><span className="status">{metal.status}</span></div>
            <div className="price">{metal.perGram24k == null ? "—" : `${metal.perGram24k.toFixed(3)} ${country.currency}`} <small>/ gram</small></div>
            <div className="subline">المصدر: {metal.provider}. السعر مرجعي وليس سعر شراء أو بيع للمحل.</div>
            <div className="mini-grid"><div><span>Spot</span><b>{metal.spot == null ? "—" : `${metal.spot.toFixed(2)} ${country.currency}`}</b></div><div><span>Bid</span><b>{metal.bid == null ? "—" : `${metal.bid.toFixed(2)} ${country.currency}`}</b></div><div><span>Ask</span><b>{metal.ask == null ? "—" : `${metal.ask.toFixed(2)} ${country.currency}`}</b></div></div>
          </section>
        )}

        {section === "markets" && <div className="grid four">{snapshot.markets.length ? snapshot.markets.map((q) => <div className="card" key={q.instrument}><span className="muted">{q.instrument}</span><strong className="metric">{q.spot?.toLocaleString() ?? "—"}</strong><span className="muted">{q.status} · {q.currency}</span></div>) : <div className="notice">لا توجد حاليًا بيانات مؤشرات تسمح المنصة بعرضها كبيانات حية.</div>}</div>}

        {section === "stocks" && <div className="grid four">{snapshot.stocks.length ? snapshot.stocks.map((q) => <div className="card" key={q.instrument}><span className="muted">{q.instrument}</span><strong className="metric">{q.spot == null ? "—" : `$${q.spot.toFixed(2)}`}</strong><span className="muted">{q.status}</span></div>) : <div className="notice">مصدر الأسهم التجاري المسموح للعرض الخارجي غير مفعّل حاليًا.</div>}</div>}

        {section === "news" && <div className="grid">{snapshot.news.length ? snapshot.news.map((item) => <article className="card" key={item.id}><div className="card-top"><strong>{item.title}</strong><span className="status">{item.status}</span></div><div className="muted" style={{marginTop:10}}>{item.source} · {item.category} · {item.language}</div></article>) : <div className="notice">لا يوجد مصدر أخبار خارجي مفعّل حاليًا.</div>}</div>}

        {section === "demo" && <div className="card"><h2>شاشة تجريبية</h2><p className="hero-copy">هذه معاينة فقط. البيانات التجريبية موسومة بوضوح ولن تُستخدم كبيانات سوق حقيقية.</p><div className="grid four">{["Classic", "Modern", "Premium"].map((theme) => <div className="card" key={theme}><strong>{theme}</strong><div className="metric">24K · {snapshot.gold.purities["24K"]?.toFixed(3) ?? "—"} {country.currency}</div><span className="muted">Demo</span></div>)}</div></div>}

        {(section === "login" || section === "signup") && <div className="card" style={{maxWidth:520}}><div className="notice">واجهة المصادقة محجوزة للبنية الآمنة للمشروع. لا يتم طلب كلمة مرور للشاشة نفسها؛ اقتران الشاشة يتم برمز مؤقت لاحقًا.</div><div className="actions" style={{marginTop:18}}><Link href="/" className="btn primary">العودة للرئيسية</Link><Link href="/demo" className="btn ghost">معاينة الشاشة</Link></div></div>}
      </main>
      <footer className="footer"><div className="wrap">المعلومات مرجعية وليست خدمة وساطة أو استشارة استثمارية.</div></footer>
    </div>
  );
}
