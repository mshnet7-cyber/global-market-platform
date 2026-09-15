import Link from "next/link";
import { countries } from "../../../lib/config";
import { getSnapshot } from "../../../lib/providers";

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const country = countries[0];
  const snapshot = await getSnapshot(country.currency, "ar", false);
  const gold = snapshot.gold;

  return <main className="wrap section">
    <div className="eyebrow">STORE REFERENCE PAGE</div>
    <h1>{slug.replace(/[-_]+/g, " ")}</h1>
    <p className="hero-copy">صفحة متجر عامة تعرض الأسعار المرجعية فقط. لا توجد أسعار شراء أو بيع أو مصنعية خاصة بالمحل.</p>
    <section className="gold-card">
      <div className="card-top"><div><span className="muted">Oman · Reference</span><strong>XAU/USD</strong></div><span className="status">{gold.status}</span></div>
      <div className="price">{gold.perGram24k == null ? "—" : `${gold.perGram24k.toFixed(3)} ${country.currency}`} <small>/ gram 24K</small></div>
      <div className="subline">المصدر: {gold.provider}. وقت البيانات: {gold.timestamp ?? "—"}</div>
      <div className="mini-grid"><div><span>Spot</span><b>{gold.spot == null ? "—" : gold.spot.toFixed(2)}</b></div><div><span>Bid</span><b>{gold.bid == null ? "—" : gold.bid.toFixed(2)}</b></div><div><span>Ask</span><b>{gold.ask == null ? "—" : gold.ask.toFixed(2)}</b></div></div>
    </section>
    <div className="actions" style={{marginTop:20}}><Link href="/demo" className="btn primary">إنشاء شاشة لهذا المتجر</Link><Link href="/" className="btn ghost">الرئيسية</Link></div>
  </main>;
}
