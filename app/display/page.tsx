import Link from "next/link";

const states = [
  ["غير مقترنة", "الجهاز لم يتم ربطه"],
  ["Pairing", "رمز اقتران مؤقت من 6 أرقام"],
  ["Connected", "جلسة جهاز آمنة وقابلة للإلغاء"],
  ["Offline", "يعرض آخر Snapshot صالح مع وقت التحديث"],
  ["Revoked", "تم إلغاء جلسة الجهاز"],
];

export default function DisplayPage() {
  return <main className="wrap section">
    <div className="eyebrow">DIGITAL DISPLAYS</div>
    <h1>إدارة الشاشات</h1>
    <p className="hero-copy">لا تُخزّن كلمة مرور على شاشة المحل. الاقتران يعتمد رمزًا مؤقتًا، والجلسة قابلة للإلغاء عن بُعد.</p>
    <div className="grid four">
      {states.map(([title, text]) => <section className="card" key={title}><strong>{title}</strong><div className="notice">{text}</div></section>)}
    </div>
    <div className="card" style={{marginTop:20}}>
      <h2>شاشة تجريبية</h2>
      <p className="hero-copy">القوالب المعتمدة: Classic وModern وPremium. العرض الحقيقي يستخدم Snapshot ثم Broadcast، مع polling وcache كخطة احتياطية.</p>
      <div className="actions"><Link href="/demo" className="btn primary">فتح المعاينة</Link><Link href="/connect" className="btn ghost">اقتران شاشة</Link></div>
    </div>
  </main>;
}
