import Link from "next/link";

const plans = [
  { name: "الشاشة", monthly: "5", halfYear: "25", yearly: "50", extraDiscount: "2.5%", features: ["شاشة المحل الأساسية", "أسعار الذهب والفضة", "محتوى وعروض المحل", "قوالب الشاشة", "تحديث تلقائي"] },
  { name: "الأعمال", monthly: "25", halfYear: "125", yearly: "240", extraDiscount: "5%", features: ["المبيعات وPOS", "المشتريات والموردون", "المصاريف والصندوق", "العملاء والأصناف", "الفواتير والتقارير الأساسية", "بدون AI متقدم"] },
  { name: "الكاملة", monthly: "46", halfYear: "247", yearly: "450", extraDiscount: "8%", features: ["كل مزايا الأعمال", "AI/OCR", "شراء الذهب من الأفراد", "الإصلاحات وتتبع القطعة", "المخزون والجرد والفروع", "المحاسبة والضرائب المتقدمة", "الموافقات وسجل التدقيق"] },
];

export default function PricingPage() {
  return <div className="app-shell">
    <header className="topbar"><div className="container nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="nav-links"><Link href="/gold">الذهب</Link><Link href="/markets">الأسواق</Link><Link href="/news">الأخبار</Link><Link href="/pricing">الباقات</Link></nav><div className="nav-actions"><Link className="btn btn-ghost" href="/login">تسجيل الدخول</Link><Link className="btn btn-primary" href="/demo">ابدأ الآن</Link></div></div></header>
    <main className="container section">
      <section className="hero" style={{paddingTop:48}}><div><div className="eyebrow">PLANS & TOOLS</div><h1 style={{fontSize:"clamp(40px,5vw,62px)"}}>اختر مستوى التشغيل المناسب لمحلك.</h1><p className="hero-copy">ابدأ بالشاشة، انتقل إلى إدارة الأعمال، أو استخدم المنصة الكاملة عندما تحتاج التشغيل والمراقبة والامتثال في مساحة واحدة.</p></div><div className="hero-card"><div className="kicker">ADD-ON</div><div className="metric">شاشة إضافية</div><div className="price-xl" style={{fontSize:48,marginTop:18}}>4 ر.ع</div><div className="meta">شهريًا · 21 ر.ع لـ6 أشهر · 44 ر.ع سنويًا</div></div></section>
      <div className="grid three">{plans.map((plan, index) => <section className="card" key={plan.name} style={index===2?{borderColor:"rgba(216,181,106,.45)"}:undefined}><div className="card-top"><div><div className="eyebrow">PLAN {String(index+1).padStart(2,"0")}</div><strong style={{fontSize:20}}>{plan.name}</strong></div><span className="status">خصم الفروع {plan.extraDiscount}</span></div><div className="price-xl" style={{fontSize:46,margin:"24px 0 8px"}}>{plan.monthly} <span style={{fontSize:15,color:"var(--muted)",letterSpacing:0}}>ر.ع / شهر</span></div><div className="meta">6 أشهر: {plan.halfYear} ر.ع · سنة: {plan.yearly} ر.ع</div><div className="section" style={{padding:"24px 0 4px"}}>{plan.features.map((f) => <div className="notice" key={f} style={{marginTop:9}}>{f}</div>)}</div><Link href="/demo" className="btn primary" style={{width:"100%"}}>جرّب المنصة</Link></section>)}</div>
    </main>
  </div>;
}
