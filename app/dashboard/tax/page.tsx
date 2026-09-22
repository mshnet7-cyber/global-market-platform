import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "../DashboardHeader";
import { getMerchantContext } from "../../../lib/merchant-access";
import MoneyDisplay from "../../../components/MoneyDisplay";

export default async function TaxPage(){
 const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user) redirect("/login?next=/dashboard/tax");
 if(!organization||!planCode||role==="viewer") redirect("/dashboard");
 const [{data:sales},{data:purchases},{data:expenses},{data:profiles}]=await Promise.all([
  supabase.from("gmp_sales").select("total,vat_amount,status,issued_at").eq("organization_id",organization.id).limit(1000),
  supabase.from("gmp_purchases").select("total,vat_amount,status,purchase_date").eq("organization_id",organization.id).limit(1000),
  supabase.from("gmp_expenses").select("amount,vat_amount,status,expense_date").eq("organization_id",organization.id).limit(1000),
  supabase.from("gmp_country_invoice_profiles").select("country_code,tax_number,vat_rate,e_invoice_enabled,store_id").eq("organization_id",organization.id).limit(100)
 ]);
 const postedSales=(sales??[]).filter(x=>x.status==="posted"||x.status==="completed");
 const postedPurchases=(purchases??[]).filter(x=>x.status==="received"||x.status==="posted"||x.status==="completed");
 const activeExpenses=(expenses??[]).filter(x=>x.status!=="voided");
 const outputVat=postedSales.reduce((n,x)=>n+Number(x.vat_amount||0),0);
 const inputVat=postedPurchases.reduce((n,x)=>n+Number(x.vat_amount||0),0)+activeExpenses.reduce((n,x)=>n+Number(x.vat_amount||0),0);
 const netVat=outputVat-inputVat;
 return <div className="dashboard-shell"><DashboardHeader organizationName={organization.name} role={role} planName={planCode==="business"?"الكاملة":planCode==="pro"?"الأعمال":planCode}/>
 <main className="container dashboard-main">
  <section className="dashboard-hero"><div><div className="eyebrow">الضرائب</div><h1 className="dashboard-title">ملخص ضريبة القيمة المضافة</h1><p className="dashboard-subtitle">ملخص داخلي مشتق من العمليات المسجلة. لا يمثل إقرارًا حكوميًا ولا يتم إرساله تلقائيًا.</p></div><div className="actions"><Link href="/dashboard/invoicing" className="btn primary">الفوترة الإلكترونية</Link><Link href="/dashboard/reports" className="btn">التقارير</Link></div></section>
  <section className="dashboard-kpis"><div className="kpi"><div className="kpi-label">VAT مخرجات</div><div className="kpi-value"><MoneyDisplay value={outputVat} currency="OMR" locale="ar-OM"/></div></div><div className="kpi"><div className="kpi-label">VAT مدخلات</div><div className="kpi-value"><MoneyDisplay value={inputVat} currency="OMR" locale="ar-OM"/></div></div><div className="kpi"><div className="kpi-label">الصافي الحسابي</div><div className="kpi-value"><MoneyDisplay value={netVat} currency="OMR" locale="ar-OM"/></div></div><div className="kpi"><div className="kpi-label">ملفات الدولة</div><div className="kpi-value">{profiles?.length??0}</div></div></section>
  <section className="card" style={{marginTop:20}}><div className="section-head"><div><div className="eyebrow">ملفات الضريبة</div><h2>إعدادات الدولة والفوترة</h2></div></div><div className="stage2-table-wrap"><table><thead><tr><th>الدولة</th><th>الرقم الضريبي</th><th>النسبة</th><th>الفوترة الإلكترونية</th><th>المتجر</th></tr></thead><tbody>{(profiles??[]).map(p=><tr key={p.id}><td>{p.country_code}</td><td>{p.tax_number??"—"}</td><td>{p.vat_rate}%</td><td>{p.e_invoice_enabled?"مفعّلة":"غير مفعّلة"}</td><td>{p.store_id??"عام"}</td></tr>)}</tbody></table></div></section>
 </main></div>;
}
