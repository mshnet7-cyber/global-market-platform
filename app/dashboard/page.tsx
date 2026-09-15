import Link from "next/link";

const checks = [
  ["الحساب", "جاهز للربط مع Supabase Auth"],
  ["المتجر", "إدارة المتجر ستكون من هذه المساحة"],
  ["الشاشات", "اقتران مؤقت وإدارة جلسات العرض"],
  ["الاشتراك", "Entitlements حسب الخطة وليس اسم الخطة"],
];

export default function DashboardPage() {
  return <main className="wrap section">
    <div className="eyebrow">DASHBOARD</div>
    <h1>لوحة التحكم</h1>
    <p className="hero-copy">المساحة الخاصة بالمالك والإدارة. لا تعتمد هذه الصفحة على بيانات متجر أو اشتراك وهمية.</p>
    <div className="grid four">
      {checks.map(([title, text]) => <section className="card" key={title}><strong>{title}</strong><div className="notice">{text}</div></section>)}
    </div>
    <div className="actions" style={{marginTop:24}}>
      <Link href="/display" className="btn primary">إدارة الشاشات</Link>
      <Link href="/pricing" className="btn ghost">الخطط</Link>
    </div>
  </main>;
}
