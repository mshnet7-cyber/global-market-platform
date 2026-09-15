export default function LoginPage() {
  return <main className="wrap section">
    <div className="eyebrow">ACCOUNT</div>
    <h1>تسجيل الدخول</h1>
    <section className="card" style={{maxWidth:520}}>
      <form className="grid" action="/api/auth/login" method="post">
        <label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" required /></label>
        <label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="current-password" required /></label>
        <button className="btn primary" type="submit">دخول</button>
      </form>
      <div className="notice">تسجيل الدخول مخصص للحساب الإداري. شاشة المحل لا تستخدم كلمة مرور الحساب.</div>
    </section>
  </main>;
}
