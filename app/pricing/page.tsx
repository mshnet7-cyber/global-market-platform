import Link from "next/link";

const plans = [
  {
    name: "الشاشة",
    monthly: "5",
    halfYear: "25",
    yearly: "50",
    extraDiscount: "2.5%",
    features: ["شاشة المحل الأساسية", "أسعار الذهب والفضة", "محتوى وعروض المحل", "قوالب الشاشة", "تحديث تلقائي"],
  },
  {
    name: "الأعمال",
    monthly: "25",
    halfYear: "125",
    yearly: "240",
    extraDiscount: "5%",
    features: ["المبيعات وPOS", "المشتريات والموردون", "المصاريف والصندوق", "العملاء والأصناف", "الفواتير والتقارير الأساسية", "بدون AI متقدم"],
  },
  {
    name: "الكاملة",
    monthly: "46",
    halfYear: "247",
    yearly: "450",
    extraDiscount: "8%",
    features: ["كل مزايا الأعمال", "AI/OCR", "شراء الذهب من الأفراد", "الإصلاحات وتتبع القطعة", "المخزون والجرد والفروع", "المحاسبة والضرائب المتقدمة", "الموافقات وسجل التدقيق"],
  },
];

export default function PricingPage() {
  return <main className="wrap section">
    <div className="eyebrow">PLANS</div>
    <h1>باقات المنصة</h1>
    <p className="hero-copy">اختر ما يحتاجه محلك فقط، ويمكنك الترقية لاحقًا. الفرع الإضافي يحصل على خصم بحسب الباقة.</p>
    <div className="grid three">
      {plans.map((plan) => <section className="card" key={plan.name}>
        <div className="card-top"><strong>{plan.name}</strong><span className="status">خصم الفروع {plan.extraDiscount}</span></div>
        <div className="metric">{plan.monthly} ر.ع <span className="muted">/ شهر</span></div>
        <div className="notice">6 أشهر: <strong>{plan.halfYear} ر.ع</strong></div>
        <div className="notice">سنة: <strong>{plan.yearly} ر.ع</strong></div>
        {plan.features.map((f) => <div className="notice" key={f}>{f}</div>)}
        <Link href="/demo" className="btn primary" style={{marginTop:14}}>جرّب الشاشة</Link>
      </section>)}
    </div>
    <section className="card" style={{marginTop:24}}>
      <strong>الشاشات الإضافية</strong>
      <p className="hero-copy">4 ر.ع شهريًا · 21 ر.ع لـ6 أشهر · 44 ر.ع سنويًا لكل شاشة إضافية.</p>
    </section>
  </main>;
}
