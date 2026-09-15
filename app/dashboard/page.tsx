import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?next=/dashboard");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { data: organizations } = await supabase.from("gmp_organizations").select("id,name,slug,created_at").eq("owner_id", user.id).order("created_at", { ascending: true });
  const organization = organizations?.[0];
  const { data: stores } = organization ? await supabase.from("gmp_stores").select("id,name,slug,country_code,currency,timezone,created_at").eq("organization_id", organization.id).order("created_at", { ascending: true }) : { data: [] };

  return <main className="wrap section">
    <div className="eyebrow">DASHBOARD</div>
    <h1>لوحة التحكم</h1>
    <p className="hero-copy">مرحباً {user.email}. هنا تتم إدارة المؤسسة والمتاجر والشاشات والاشتراكات.</p>

    <section className="card" style={{marginTop:24}}>
      <strong>المؤسسة</strong>
      {organization ? <div className="notice" style={{marginTop:16}}><strong>{organization.name}</strong><br /><span>{organization.slug}</span></div> : <div className="notice" style={{marginTop:16}}>لا توجد مؤسسة لهذا الحساب بعد.</div>}
    </section>

    <section className="card" style={{marginTop:20}}>
      <strong>المتاجر</strong>
      {stores?.length ? <div className="grid" style={{marginTop:16}}>{stores.map((store) => <Link href={`/store/${store.slug}`} className="notice" key={store.id}><strong>{store.name}</strong><br /><span>{store.currency} · {store.country_code} · {store.timezone}</span></Link>)}</div> : <div className="notice" style={{marginTop:16}}>لم يتم إنشاء متجر بعد.</div>}
      {organization && <form action="/api/stores/create" method="post" className="grid two-col" style={{marginTop:16}}>
        <label className="label">اسم المتجر<input className="select" name="name" placeholder="اسم محل الذهب" minLength={2} maxLength={120} required /></label>
        <div className="actions" style={{alignItems:"end"}}><button className="btn primary" type="submit">إنشاء متجر</button></div>
      </form>}
    </section>

    <div className="actions" style={{marginTop:24}}>
      <Link href="/display" className="btn primary">إدارة الشاشات</Link>
      <Link href="/pricing" className="btn ghost">الخطط</Link>
      <Link href="/" className="btn ghost">الواجهة العامة</Link>
    </div>
  </main>;
}
