import Link from "next/link";

function safeNext(value: string | undefined) {
  const next = value?.trim();
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

const planNames: Record<string, string> = { starter: "الشاشة", pro: "الأعمال", business: "الكاملة" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; plan?: string; error?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const plan = params.plan && planNames[params.plan] ? params.plan : "";
  const error = params.error === "invalid" ? "أدخل الاسم والبريد وكلمة مرور من 10 أحرف على الأقل." : params.error === "signup" ? "تعذر إنشاء الحساب. تحقق من البريد وحاول مرة أخرى." : params.error === "account_setup" ? "تم إنشاء حساب الدخول لكن تعذر إعداد المؤسسة. تواصل مع الدعم." : "";

  return <div className="page-frame login-page signup-page" dir="rtl" lang="ar">
    <header className="topbar"><div className="container nav site-nav">
      <Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link>
      <nav className="nav-links" aria-label="التنقل الرئيسي">
        <Link href="/gold">الذهب</Link><Link href="/silver">الفضة</Link><Link href="/markets">الأسواق</Link><Link href="/stocks">الأسهم</Link><Link href="/currencies">العملات</Link><Link href="/news">الأخبار</Link><Link href="/pricing">الباقات</Link>
      </nav>
      <div className="nav-actions"><Link className="btn btn-ghost" href="/login">تسجيل الدخول</Link><Link className="btn btn-primary" href="/demo">المعاينة</Link></div>
    </div></header>
    <main className="container login-layout signup-layout">
      <section className="login-story">
        <div className="eyebrow"><span className="live-dot" />مساحة التاجر</div>
        <h1>أنشئ مساحتك التشغيلية.</h1>
        <p>ابدأ بحسابك، ثم أكمل المؤسسة والمتجر من داخل المنصة. الواجهة مصممة للعمل اليومي مع المبيعات والمخزون والتقارير والشاشات.</p>
        <div className="login-highlights">
          <div className="login-highlight"><strong>البداية</strong><span>حساب وتسجيل آمن</span></div>
          <div className="login-highlight"><strong>المتجر</strong><span>المؤسسة والمتجر</span></div>
          <div className="login-highlight"><strong>التشغيل</strong><span>مساحة تشغيل موحدة</span></div>
        </div>
      </section>
      <section className="login-card" aria-labelledby="signup-title">
        <div className="eyebrow">إعداد الحساب</div>
        <h2 id="signup-title">إنشاء الحساب</h2>
        <p>أنشئ حساب التاجر أولًا، ثم تابع إعداد المؤسسة والمتجر.</p>
        {plan && <div className="notice" role="status">الخطة المحددة مبدئيًا: <strong>{planNames[plan]}</strong></div>}
        {error && <div className="notice" role="alert">{error}</div>}
        <form className="login-form" action="/api/auth/signup" method="post">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="plan" value={plan} />
          <label className="label">الاسم<input className="select" type="text" name="name" autoComplete="name" required /></label>
          <label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" inputMode="email" required /></label>
          <label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="new-password" minLength={10} required /></label>
          <button className="btn btn-primary" type="submit">إنشاء الحساب والمتابعة</button>
        </form>
        <div className="actions" style={{marginTop:14}}>
          <Link className="btn" href={"/login?next=" + encodeURIComponent(next)}>لديك حساب؟ تسجيل الدخول</Link>
          <Link className="btn btn-ghost" href="/pricing">عرض الباقات</Link>
        </div>
        <div className="login-security">بعد التسجيل تُستكمل خطوة إنشاء المؤسسة والمتجر. لا يتم تفعيل أي تكامل خارجي دون الاعتماد وبيانات الاعتماد المطلوبة.</div>
      </section>
    </main>
  </div>;
}
