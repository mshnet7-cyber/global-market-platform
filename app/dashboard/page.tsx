import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../lib/supabase/admin";
import { countries } from "../../lib/config";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase) redirect("/login?next=/dashboard");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  let { data: organizations } = await supabase
    .from("gmp_organizations")
    .select("id,name,slug,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  // Email confirmation can leave the auth user without GMP records. Bootstrap is idempotent.
  if ((!organizations || organizations.length === 0) && admin) {
    const name = String(user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "My Organization").trim().slice(0, 120) || "My Organization";
    const slugBase = name.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "organization";
    const slug = `${slugBase}-${user.id.slice(0, 8)}`;
    const { data: org, error: orgError } = await admin.from("gmp_organizations").insert({ name, slug, owner_id: user.id }).select("id,name,slug,created_at").single();
    if (!orgError && org) {
      await admin.from("gmp_profiles").upsert({ id: user.id, display_name: name }, { onConflict: "id" });
      await admin.from("gmp_organization_members").upsert({ organization_id: org.id, user_id: user.id, role: "owner" }, { onConflict: "organization_id,user_id" });
      const { data: store } = await admin.from("gmp_stores").insert({ organization_id: org.id, name, slug: `${slugBase}-store-${user.id.slice(0, 8)}`, country_code: "OM", currency: "OMR", timezone: "Asia/Muscat" }).select("id").single();
      if (store) await admin.from("gmp_store_settings").insert({ store_id: store.id });
      organizations = [org];
    }
  }

  const organization = organizations?.[0];
  const { data: stores } = organization
    ? await supabase.from("gmp_stores").select("id,name,slug,country_code,currency,timezone,created_at").eq("organization_id", organization.id).order("created_at", { ascending: true })
    : { data: [] };

  return <main className="wrap section">
    <div className="eyebrow">DASHBOARD</div>
    <h1>لوحة التحكم</h1>
    <p className="hero-copy">مرحباً {user.email}. هنا تتم إدارة المؤسسة والمتاجر والشاشات والاشتراكات.</p>

    <section className="card" style={{marginTop:24}}>
      <strong>المؤسسة</strong>
      {organization ? <div className="notice" style={{marginTop:16}}><strong>{organization.name}</strong><br /><span>{organization.slug}</span></div> : <div className="notice" style={{marginTop:16}}>تعذر إنشاء المؤسسة تلقائيًا. تحقق من إعدادات قاعدة البيانات.</div>}
    </section>

    <section className="card" style={{marginTop:20}}>
      <strong>المتاجر</strong>
      {stores?.length ? <div className="grid" style={{marginTop:16}}>{stores.map((store) => <Link href={`/store/${store.slug}`} className="notice" key={store.id}><strong>{store.name}</strong><br /><span>{store.currency} · {store.country_code} · {store.timezone}</span></Link>)}</div> : <div className="notice" style={{marginTop:16}}>لم يتم إنشاء متجر بعد.</div>}
      {organization && <form action="/api/stores/create" method="post" className="grid two-col" style={{marginTop:16}}>
        <label className="label">اسم المتجر<input className="select" name="name" placeholder="اسم محل الذهب" minLength={2} maxLength={120} required /></label>
        <label className="label">الدولة<select className="select" name="country_code" defaultValue="OM">{countries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label>
        <label className="label">عملة المتجر<input className="select" name="currency" defaultValue="OMR" placeholder="OMR" maxLength={3} required /></label>
        <label className="label">المنطقة الزمنية<input className="select" name="timezone" defaultValue="Asia/Muscat" placeholder="Asia/Muscat" required /></label>
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
