import Link from "next/link";

const plans = [
  { name: "Starter", omr: "—", features: ["متجر واحد", "شاشة واحدة", "قالب شاشة أساسي", "حالة اتصال واضحة"] },
  { name: "Pro", omr: "—", features: ["عدة شاشات", "تنبيهات", "تحليلات", "إدارة متقدمة للشاشات"] },
  { name: "Business", omr: "—", features: ["عدة متاجر", "أعضاء وصلاحيات", "إدارة مركزية", "تحليلات متقدمة"] },
];

export default function PricingPage() {
  return <main className="wrap section">
    <div className="eyebrow">PLANS</div>
    <h1>خطط المنصة</h1>
    <p className="hero-copy">ثلاث خطط فقط. الأسعار النهائية ستُثبت بعد اعتماد نموذج التكلفة ومزود الدفع.</p>
    <div className="grid four">
      {plans.map((plan) => <section className="card" key={plan.name}>
        <div className="card-top"><strong>{plan.name}</strong><span className="status">قريبًا</span></div>
        <div className="metric">{plan.omr} OMR / شهر</div>
        {plan.features.map((f) => <div className="notice" key={f}>{f}</div>)}
        <Link href="/demo" className="btn primary" style={{marginTop:14}}>جرّب المعاينة</Link>
      </section>)}
    </div>
  </main>;
}
