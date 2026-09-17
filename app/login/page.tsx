import Link from "next/link";

function safeNext(value: string | undefined) {
  const next = value?.trim();
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return <div className="page-frame">
    <header className="topbar"><div className="container nav site-nav"><Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link><div className="nav-actions" style={{marginInlineStart:"auto"}}><Link className="btn btn-ghost" href="/">الأسواق</Link><Link className="btn btn-primary" href="/pricing">الباقات</Link></div></div></header>
    <main className="container login-layout">
      <section className="login-story"><div className="eyebrow"><span className="live-dot" />MERCHANT WORKSPACE</div><h1>مساحتك التشغيلية تبدأ من هنا.</h1><p>سجّل الدخول لإدارة المحل، المبيعات، المخزون، التقارير والشاشات من واجهة واحدة مصممة للعمل اليومي.</p><div className="login-highlights"><div className="login-highlight"><strong>POS</strong><span>مبيعات وتشغيل سريع</span></div><div className="login-highlight"><strong>Inventory</strong><span>مخزون وحركة الأصناف</span></div><div className="login-highlight"><strong>Control</strong><span>إدارة وامتثال وتقارير</span></div></div></section>
      <section className="login-card" aria-labelledby="login-title"><div className="eyebrow">ACCOUNT ACCESS</div><h2 id="login-title">تسجيل الدخول</h2><p>استخدم بيانات الحساب الإداري للوصول إلى لوحة المحل.</p><form className="login-form" action="/api/auth/login" method="post"><input type="hidden" name="next" value={next} /><label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" inputMode="email" required /></label><label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="current-password" required /></label><button className="btn btn-primary" type="submit">دخول إلى لوحة المحل</button></form><div className="login-security">شاشة العرض العامة لا تحتاج إلى كلمة مرور الحساب. لا تدخل بياناتك على جهاز مشترك إلا بعد التأكد من تسجيل الخروج.</div></section>
    </main>
  </div>;
}
