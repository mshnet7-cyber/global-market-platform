export default function SignupPage() {
  return <main className="wrap section">
    <div className="eyebrow">ACCOUNT</div>
    <h1>إنشاء الحساب</h1>
    <section className="card" style={{maxWidth:520}}>
      <form className="grid" action="/api/auth/signup" method="post">
        <label className="label">الاسم<input className="select" type="text" name="name" autoComplete="name" required /></label>
        <label className="label">البريد الإلكتروني<input className="select" type="email" name="email" autoComplete="email" required /></label>
        <label className="label">كلمة المرور<input className="select" type="password" name="password" autoComplete="new-password" minLength={10} required /></label>
        <button className="btn primary" type="submit">إنشاء الحساب</button>
      </form>
      <div className="notice">بعد التسجيل تُستكمل خطوة إنشاء المؤسسة والمتجر، ثم الاشتراك والشاشات.</div>
    </section>
  </main>;
}
