import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?next=/dashboard");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data: organizations } = await supabase
    .from("gmp_organizations")
    .select("id,name,slug,created_at")
    .order("created_at", { ascending: true });

  return <main className="wrap section">
    <div className="eyebrow">DASHBOARD</div>
    <h1>لوحة التحكم</h1>
    <p className="hero-copy">مرحباً {user.email}. هذه المساحة خاصة بالحسابات والمتاجر والشاشات والاشتراكات.</p>

    <section className="card" style={{marginTop:24}}>
      <strong>المؤسسات</strong>
      {organizations?.length ? (
        <div className="grid" style={{marginTop:16}}>
          {organizations.map((org) => <div className="notice" key={org.id}>
            <strong>{org.name}</strong><br />
            <span>{org.slug}</span>
          </div>)}
        </div>
      ) : (
        <div className="notice" style={{marginTop:16}}>لا توجد مؤسسة مرتبطة بهذا الحساب بعد.</div>
      )}
    </section>

    <div className="actions" style={{marginTop:24}}>
      <Link href="/display" className="btn primary">إدارة الشاشات</Link>
      <Link href="/pricing" className="btn ghost">الخطط</Link>
      <Link href="/" className="btn ghost">الواجهة العامة</Link>
    </div>
  </main>;
}
