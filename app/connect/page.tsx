import Link from "next/link";

export default function ConnectPage() {
  return <main className="wrap section">
    <div className="eyebrow">PAIRING</div>
    <h1>اقتران الشاشة</h1>
    <section className="card" style={{maxWidth:680}}>
      <h2>أدخل الرمز الظاهر على الشاشة</h2>
      <p className="hero-copy">الرمز مؤقت من 6 أرقام. بعد نجاح الاقتران تُنشأ جلسة جهاز منفصلة وقابلة للإلغاء. لا تستخدم كلمة مرور الحساب على شاشة المحل.</p>
      <form className="grid two-col" action="/api/displays/pair" method="post">
        <label className="label">رمز الاقتران<input className="select" name="code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="000000" autoComplete="one-time-code" required /></label>
        <div className="actions" style={{alignItems:"end"}}><button className="btn primary" type="submit">ربط الشاشة</button><Link className="btn ghost" href="/display">إلغاء</Link></div>
      </form>
      <div className="notice">الرمز صالح لفترة قصيرة ويُستهلك مرة واحدة. بعد الاقتران لا تُحفظ كلمة مرور الحساب على جهاز العرض.</div>
    </section>
  </main>;
}
