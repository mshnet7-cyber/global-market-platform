import Link from "next/link";

export default function ConnectPage() {
  return <main className="wrap section">
    <div className="eyebrow">PAIRING</div>
    <h1>اقتران الشاشة</h1>
    <section className="card" style={{maxWidth:680}}>
      <h2>أدخل الرمز الظاهر على الشاشة</h2>
      <p className="hero-copy">الرمز مؤقت من 6 أرقام. بعد نجاح الاقتران تُنشأ جلسة جهاز قابلة للإلغاء. لا تستخدم كلمة مرور الحساب على شاشة المحل.</p>
      <form className="grid two-col" action="/connect" method="get">
        <label className="label">رمز الاقتران<input className="select" name="code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" placeholder="000000" required /></label>
        <div className="actions" style={{alignItems:"end"}}><button className="btn primary" type="submit">متابعة</button><Link className="btn ghost" href="/display">إلغاء</Link></div>
      </form>
      <div className="notice">هذه واجهة التدفق فقط. إنشاء الرمز والتحقق منه سيُوصلان إلى قاعدة البيانات مع معاملات ذرية وانتهاء صلاحية قصير.</div>
    </section>
  </main>;
}
