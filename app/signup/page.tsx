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

  return <main className="wrap section">
    <div className="eyebrow">ACCOUNT</div>
    <h1>إنشاء الحساب</h1>
    <p className="hero-copy">أنشئ حساب التاجر أولًا، ثم أكمل المؤسسة والمتجر والاشتراك من داخل المنصة.</p>
    {plan && <div className="notice" role="status">الخطة المحددة مبدئيًا: <strong>{planNames[plan]}</strong></div>}
    {error && <div className="notice" role="alert">{error}</div>}
    <section className="card" style={{maxWidth:560}}>
      <form className="grid" action="/api/auth/signup" method="post">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="plan" value={plan} />
        <label className="label">الاسم<input className="select" type="text" name="name" autoComplete="name" required /></label>
        <label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" required /></label>
        <label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="new-password" minLength={10} required /></label>
        <button className="btn primary" type="submit">إنشاء الحساب والمتابعة</button>
      </form>
      <div className="actions" style={{marginTop:12}}><Link className="btn" href={"/login?next=" + encodeURIComponent(next)}>لديك حساب؟ تسجيل الدخول</Link><Link className="btn btn-ghost" href="/pricing">عرض الباقات</Link></div>
      <div className="notice">بعد التسجيل تُستكمل خطوة إنشاء المؤسسة والمتجر، ثم الاشتراك والشاشات. لا يتم تفعيل أي تكامل خارجي دون الاعتماد وبيانات الاعتماد المطلوبة.</div>
    </section>
  </main>;
}
