import Link from "next/link";
import { loginAction } from "./actions";

function safeNext(value: string | undefined) {
  const next = value?.trim();
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; created?: string; logged_out?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const error = params.error === "credentials" ? "البريد الإلكتروني أو كلمة المرور غير صحيحة." : params.error === "invalid" ? "أدخل البريد الإلكتروني وكلمة المرور." : params.error === "unavailable" ? "خدمة تسجيل الدخول غير متاحة حاليًا." : params.error === "demo_disabled" ? "الدخول التجريبي متاح في نسخة المعاينة فقط." : params.error ? "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى." : "";
  const notice = params.created === "1" ? "تم إنشاء الحساب. سجّل الدخول للمتابعة." : params.logged_out === "1" ? "تم تسجيل الخروج." : "";

  return <div className="page-frame login-page" dir="rtl" lang="ar">
    <header className="topbar"><div className="container nav site-nav">
      <Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link>
      <nav className="nav-links" aria-label="التنقل الرئيسي">
        <Link href="/gold">الذهب</Link><Link href="/silver">الفضة</Link><Link href="/markets">الأسواق</Link><Link href="/stocks">الأسهم</Link><Link href="/currencies">العملات</Link><Link href="/news">الأخبار</Link><Link href="/pricing">الباقات</Link>
      </nav>
      <div className="nav-actions"><Link className="btn btn-ghost" href="/">الرئيسية</Link><Link className="btn btn-primary" href="/pricing">الباقات</Link></div>
    </div></header>
    <main className="container login-layout">
      <section className="login-story"><div className="eyebrow"><span className="live-dot" />مساحة التاجر</div><h1>مساحتك التشغيلية تبدأ من هنا.</h1><p>سجّل الدخول لإدارة المحل، المبيعات، المخزون، التقارير والشاشات من واجهة واحدة مصممة للعمل اليومي.</p><div className="login-highlights"><div className="login-highlight"><strong>نقطة البيع</strong><span>مبيعات وتشغيل سريع</span></div><div className="login-highlight"><strong>المخزون</strong><span>مخزون وحركة الأصناف</span></div><div className="login-highlight"><strong>الإدارة</strong><span>إدارة وامتثال وتقارير</span></div></div></section>
      <section className="login-card" aria-labelledby="login-title"><div className="eyebrow">الوصول إلى الحساب</div><h2 id="login-title">تسجيل الدخول</h2><p>استخدم بيانات الحساب الإداري للوصول إلى لوحة المحل.</p>
        {error && <div className="notice" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}
        <form className="login-form" action={loginAction}><input type="hidden" name="next" value={next} /><label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" inputMode="email" maxLength={320} required /></label><label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="current-password" maxLength={256} required /></label><button className="btn btn-primary" type="submit">دخول إلى لوحة المحل</button></form>
        <div className="actions" style={{marginTop:14}}><Link className="btn" href={"/signup?next=" + encodeURIComponent(next)}>إنشاء حساب جديد</Link><Link className="btn btn-ghost" href="/pricing">مشاهدة الباقات</Link></div>
        {process.env.VERCEL_ENV === "preview" && <div className="notice" style={{marginTop:16}}>
          <div style={{marginTop:10,fontSize:13}}>استخدم بيانات الحساب التجريبي أدناه لتسجيل الدخول إلى بيئة المعاينة.</div>
          <strong>بيانات التجربة للمعاينة</strong>
          <div style={{marginTop:8}}>إدارة المنصة: <code>admin@accounts.omangold.local</code> / <code>GMP-Demo-Admin-2026!</code></div>
          <div style={{marginTop:4}}>المحل: <code>sharaf@accounts.omangold.local</code> / <code>GMP-Demo-Shop-2026!</code></div>
        </div>}
        <div className="login-security">شاشة العرض العامة لا تحتاج إلى كلمة مرور الحساب. حسابات التجربة تعمل في نسخة المعاينة فقط.</div>
      </section>
    </main>
  </div>;
}
