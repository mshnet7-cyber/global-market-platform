import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardHeader from "../DashboardHeader";
import { getMerchantContext } from "../../../lib/merchant-access";
import MoneyDisplay from "../../../components/MoneyDisplay";

export default async function AccountingPage(){
 const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user) redirect("/login?next=/dashboard/accounting");
 if(!organization||!planCode||role==="viewer") redirect("/dashboard");
 const [{data:accounts},{data:entries}]=await Promise.all([
  supabase.from("gmp_accounts").select("id,code,name,account_type,system_key,active").eq("organization_id",organization.id).order("code"),
  supabase.from("gmp_journal_entries").select("id,entry_no,reference_type,reference_id,description,entry_date,status").eq("organization_id",organization.id).order("entry_date",{ascending:false}).limit(300)
 ]);
 const ids=(accounts??[]).map(a=>a.id);
 const {data:lines}=ids.length?await supabase.from("gmp_journal_lines").select("journal_entry_id,account_id,debit,credit,memo").in("account_id",ids).limit(2000):{data:[] as any[]};
 const byAccount=new Map<string,{debit:number;credit:number}>();
 for(const l of lines??[]){const x=byAccount.get(l.account_id)||{debit:0,credit:0};x.debit+=Number(l.debit||0);x.credit+=Number(l.credit||0);byAccount.set(l.account_id,x);}
 const debit=(lines??[]).reduce((n,l)=>n+Number(l.debit||0),0);
 const credit=(lines??[]).reduce((n,l)=>n+Number(l.credit||0),0);
 return <div className="dashboard-shell"><DashboardHeader organizationName={organization.name} role={role} planName={planCode==="business"?"الكاملة":planCode==="pro"?"الأعمال":planCode}/>
 <main className="container dashboard-main">
  <section className="dashboard-hero"><div><div className="eyebrow">المحاسبة</div><h1 className="dashboard-title">المحاسبة والدفتر العام</h1><p className="dashboard-subtitle">دليل الحسابات، القيود، والأرصدة المشتقة من القيود المرحلة. لا يتم تعديل القيود من هذا العرض.</p></div><div className="actions"><Link href="/dashboard/reports" className="btn">التقارير</Link><Link href="/dashboard/invoices" className="btn primary">الفواتير</Link></div></section>
  <section className="dashboard-kpis"><div className="kpi"><div className="kpi-label">الحسابات</div><div className="kpi-value">{accounts?.length??0}</div></div><div className="kpi"><div className="kpi-label">القيود</div><div className="kpi-value">{entries?.length??0}</div></div><div className="kpi"><div className="kpi-label">إجمالي مدين</div><div className="kpi-value"><MoneyDisplay value={debit} currency="OMR" locale="ar-OM"/></div></div><div className="kpi"><div className="kpi-label">إجمالي دائن</div><div className="kpi-value"><MoneyDisplay value={credit} currency="OMR" locale="ar-OM"/></div></div></section>
  <section className="card" style={{marginTop:20}}><div className="section-head"><div><div className="eyebrow">دليل الحسابات</div><h2>الحسابات والأرصدة</h2></div><span className="meta">الأرصدة من القيود الموجودة فقط</span></div><div className="stage2-table-wrap"><table><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>مدين</th><th>دائن</th><th>الرصيد الصافي</th></tr></thead><tbody>{(accounts??[]).map(a=>{const x=byAccount.get(a.id)||{debit:0,credit:0};return <tr key={a.id}><td>{a.code}</td><td>{a.name}</td><td>{a.account_type}</td><td><MoneyDisplay value={x.debit} currency="OMR" locale="ar-OM"/></td><td><MoneyDisplay value={x.credit} currency="OMR" locale="ar-OM"/></td><td><MoneyDisplay value={x.debit-x.credit} currency="OMR" locale="ar-OM"/></td></tr>})}</tbody></table></div></section>
  <section className="card" style={{marginTop:20}}><div className="section-head"><div><div className="eyebrow">دفتر الأستاذ</div><h2>آخر القيود</h2></div></div><div className="stage2-table-wrap"><table><thead><tr><th>القيد</th><th>المرجع</th><th>الوصف</th><th>التاريخ</th><th>الحالة</th></tr></thead><tbody>{(entries??[]).map(e=><tr key={e.id}><td>#{e.entry_no}</td><td>{e.reference_type}</td><td>{e.description}</td><td>{e.entry_date}</td><td>{e.status}</td></tr>)}</tbody></table></div></section>
 </main></div>;
}
