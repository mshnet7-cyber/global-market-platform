import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "../DashboardHeader";
import { getMerchantContext } from "../../../lib/merchant-access";
import MoneyDisplay from "../../../components/MoneyDisplay";

const statusLabel:Record<string,string>={draft:"مسودة",posted:"معتمدة",voided:"ملغاة",cancelled:"ملغاة"};
const paymentLabel:Record<string,string>={cash:"نقدي",bank:"بنك",card:"بطاقة",wallet:"محفظة",other:"أخرى"};

export default async function InvoicesPage(){
 const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user) redirect("/login?next=/dashboard/invoices");
 if(!organization||!planCode||role==="viewer") redirect("/dashboard");

 const [{data:sales},{data:customers},{data:stores}]=await Promise.all([
  supabase.from("gmp_sales").select("id,invoice_no,store_id,customer_id,status,subtotal,discount_amount,vat_amount,total,payment_method,notes,issued_at,created_at").eq("organization_id",organization.id).order("created_at",{ascending:false}).limit(300),
  supabase.from("gmp_customers").select("id,name,phone").eq("organization_id",organization.id).limit(500),
  supabase.from("gmp_stores").select("id,name,currency").eq("organization_id",organization.id).limit(100)
 ]);
 const customerMap=new Map((customers??[]).map(c=>[c.id,c]));
 const storeMap=new Map((stores??[]).map(s=>[s.id,s]));
 const rows=sales??[];
 const total=rows.reduce((n,s)=>n+Number(s.total||0),0);
 const vat=rows.reduce((n,s)=>n+Number(s.vat_amount||0),0);
 const posted=rows.filter(s=>s.status==="posted").length;

 return <div className="dashboard-shell">
  <DashboardHeader organizationName={organization.name} role={role} planName={planCode==="business"?"الكاملة":planCode==="pro"?"الأعمال":planCode}/>
  <main className="container dashboard-main">
   <section className="dashboard-hero">
    <div><div className="eyebrow">الفواتير · المبيعات</div><h1 className="dashboard-title">سجل الفواتير</h1><p className="dashboard-subtitle">مركز موحد لفواتير البيع، الضرائب، العملاء، وحالة الترحيل. هذه الصفحة لا تنشئ قيودًا جديدة؛ الإصدار يتم عبر مسار البيع الذري.</p></div>
    <div className="actions"><Link href="/dashboard/sales" className="btn primary">فاتورة جديدة</Link><Link href="/dashboard/invoicing" className="btn">الفوترة الإلكترونية</Link><Link href="/dashboard/reports" className="btn">التقارير</Link></div>
   </section>
   <section className="dashboard-kpis">
    <div className="kpi"><div className="kpi-label">عدد الفواتير</div><div className="kpi-value">{rows.length}</div></div>
    <div className="kpi"><div className="kpi-label">الفواتير المعتمدة</div><div className="kpi-value">{posted}</div></div>
    <div className="kpi"><div className="kpi-label">إجمالي المعروض</div><div className="kpi-value"><MoneyDisplay value={total} currency="OMR" locale="ar-OM" maximumFractionDigits={3}/></div></div>
    <div className="kpi"><div className="kpi-label">VAT المعروض</div><div className="kpi-value"><MoneyDisplay value={vat} currency="OMR" locale="ar-OM" maximumFractionDigits={3}/></div></div>
   </section>
   <section className="card" style={{marginTop:20}}>
    <div className="section-head"><div><div className="eyebrow">آخر العمليات</div><h2>الفواتير</h2></div><span className="meta">{rows.length} سجل</span></div>
    {!rows.length?<div className="empty-state">لا توجد فواتير بعد. ابدأ من نقطة البيع.</div>:
    <div className="stage2-table-wrap"><table><thead><tr><th>رقم</th><th>العميل</th><th>المحل</th><th>الإجمالي</th><th>VAT</th><th>الدفع</th><th>الحالة</th><th>التاريخ</th><th>إجراء</th></tr></thead>
    <tbody>{rows.map(s=>{const c=customerMap.get(s.customer_id);const st=storeMap.get(s.store_id);return <tr key={s.id}>
      <td><strong>#{s.invoice_no}</strong></td><td>{c?.name??"عميل نقدي"}{c?.phone&&<small style={{display:"block"}}>{c.phone}</small>}</td><td>{st?.name??"—"}</td>
      <td><MoneyDisplay value={Number(s.total||0)} currency={st?.currency||"OMR"} locale="ar-OM" maximumFractionDigits={3}/></td>
      <td><MoneyDisplay value={Number(s.vat_amount||0)} currency={st?.currency||"OMR"} locale="ar-OM" maximumFractionDigits={3}/></td>
      <td>{paymentLabel[s.payment_method??""]??s.payment_method??"—"}</td><td>{statusLabel[s.status]??s.status}</td>
      <td>{s.issued_at?new Date(s.issued_at).toLocaleString("ar-OM"):new Date(s.created_at).toLocaleString("ar-OM")}</td>
      <td><div className="actions"><Link className="btn" href="/dashboard/invoicing">إرسال إلكتروني</Link><Link className="btn" href={"/dashboard/invoices/"+s.id}>طباعة/PDF</Link></div></td>
    </tr>})}</tbody></table></div>}
   </section>
   <section className="grid three" style={{marginTop:20}}>
    <Link href="/dashboard/purchases" className="card module-card"><strong>المشتريات</strong><div className="meta">فواتير الموردين والاستلام وربط المخزون.</div><span className="module-arrow">←</span></Link>
    <Link href="/dashboard/operations?tab=contacts" className="card module-card"><strong>العملاء والموردون</strong><div className="meta">سجل الأطراف المرتبطة بالمبيعات والمشتريات.</div><span className="module-arrow">←</span></Link>
    <Link href="/dashboard/documents" className="card module-card"><strong>المستندات و OCR</strong><div className="meta">حفظ فاتورة المورد أو الإيصال ومراجعته.</div><span className="module-arrow">←</span></Link>
   </section>
  </main>
 </div>;
}
