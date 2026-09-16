import { redirect } from "next/navigation";

function safeNext(value: string | undefined) {
  const next = value?.trim();
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return <main className="wrap section">
    <div className="eyebrow">ACCOUNT</div>
    <h1>تسجيل الدخول</h1>
    <section className="card" style={{maxWidth:520}}>
      <form className="grid" action="/api/auth/login" method="post">
        <input type="hidden" name="next" value={next} />
        <label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" required /></label>
        <label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="current-password" required /></label>
        <button className="btn primary" type="submit">دخول</button>
      </form>
      <div className="notice">تسجيل الدخول مخصص للحساب الإداري. شاشة المحل لا تستخدم كلمة مرور الحساب.</div>
    </section>
  </main>;
}
