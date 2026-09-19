import Link from "next/link";

const endpoints = [
  ["GET", "/api/v2/market/gold", "Gold market reference data", "market:read"],
  ["GET", "/api/v2/market/markets", "Market reference data", "market:read"],
];

export default function DevelopersPage() {
  return <main className="stage3-page"><div className="stage3-shell">
    <header className="stage3-header">
      <div><div className="stage3-eyebrow">منصة المطورين · API V2</div><h1>واجهة بيانات عامة قابلة للتكامل.</h1><p>مصادقة بمفاتيح API، وحدود للطلبات، ومعرّفات للطلبات، وتتبع للاستخدام، واستجابات ثابتة دون كشف بيانات مؤسسات خاصة.</p></div>
      <div className="actions"><Link href="/dashboard/api-keys" className="stage3-btn stage3-btn-primary">إدارة مفاتيح API</Link><Link href="/" className="stage3-btn">الرئيسية</Link></div>
    </header>
    <section className="stage3-table-wrap"><table className="stage3-table"><thead><tr><th>الطريقة</th><th>المسار</th><th>الغرض</th><th>الصلاحية</th></tr></thead><tbody>{endpoints.map(r=><tr key={r[1]}>{r.map(c=><td key={c}>{c}</td>)}</tr>)}</tbody></table></section>
    <section className="stage3-grid" style={{marginTop:18}}>
      <article className="stage3-card"><h2>المصادقة</h2><p>استخدم x-gmp-api-key أو Authorization: Bearer. لا يتم تخزين المفتاح الخام؛ النظام يحتفظ بالـhash فقط.</p></article>
      <article className="stage3-card"><h2>الأخطاء</h2><p>كل رد خطأ يحتوي error وrequest_id، مع 401/403/429/503 وفق الحالة.</p></article>
      <article className="stage3-card"><h2>خطافات الويب</h2><p>التكاملات تستخدم توقيعات HMAC مع event IDs لمنع التكرار.</p></article>
    </section>
    <section className="stage3-panel"><h2>التشغيل</h2><p>للاستخدام الفعلي، أنشئ مفتاحًا من مساحة الحساب ثم استخدمه للوصول إلى endpoints المصرّح بها. المفاتيح متاحة فقط للحسابات ذات الخطة والصلاحية المناسبتين.</p><Link href="/dashboard/api-keys" className="stage3-btn">فتح إدارة المفاتيح</Link></section>
  </div></main>;
}
