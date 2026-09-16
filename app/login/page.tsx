import Link from "next/link";
import { redirect } from "next/navigation";

function safeNext(value: string | undefined) {
  const next = value?.trim();
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return <div className="app-shell">
    <header className="topbar"><div className="container nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><div className="nav-actions" style={{marginInlineStart:"auto"}}><Link className="btn btn-ghost" href="/">الواجهة العامة</Link><Link className="btn btn-primary" href="/pricing">الباقات</Link></div></div></header>
    <main className="container section" style={{minHeight:"calc(100vh - 78px)",display:"grid",placeItems:"center"}}>
      <section style={{width:"min(100%,520px)"}}>
        <div className="eyebrow">ACCOUNT ACCESS</div>
        <h1 style={{fontSize:"clamp(34px,5vw,52px)",margin:"0 0 12px",letterSpacing:"-.04em"}}>تسجيل الدخول</h1>
        <p className="hero-copy" style={{margin:"0 0 24px"}}>ادخل إلى مساحة إدارة المحل ومتابعة العمليات والاشتراك.</p>
        <section className="card">
          <form className="grid" action="/api/auth/login" method="post">
            <input type="hidden" name="next" value={next} />
            <label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" required /></label>
            <label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="current-password" required /></label>
            <button className="btn primary" type="submit">دخول إلى لوحة المحل</button>
          </form>
          <div className="notice">تسجيل الدخول مخصص للحساب الإداري. شاشة العرض العامة لا تحتاج إلى كلمة مرور الحساب.</div>
        </section>
      </section>
    </main>
  </div>;
}
