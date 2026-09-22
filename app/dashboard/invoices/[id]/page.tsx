import {redirect} from "next/navigation";
import Link from "next/link";
import DashboardHeader from "../../DashboardHeader";
import {getMerchantContext} from "../../../../lib/merchant-access";
import MoneyDisplay from "../../../../components/MoneyDisplay";
import PrintButton from "../../../../components/PrintButton";
export default async function InvoiceDetail({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user)redirect("/login?next=/dashboard/invoices/"+id);
 if(!organization||!planCode)redirect("/dashboard");
 const {data:sale}=await supabase.from("gmp_sales").select("id,invoice_no,store_id,customer_id,status,subtotal,discount_amount,vat_amount,total,payment_method,notes,issued_at,created_at").eq("id",id).eq("organization_id",organization.id).maybeSingle();
 if(!sale)redirect("/dashboard/invoices");
 const [{data:lines},{data:customer},{data:store}]=await Promise.all([
  supabase.from("gmp_sale_lines").select("id,product_id,quantity,weight_grams,unit_price,making_charge,discount_amount,vat_amount,line_total").eq("sale_id",sale.id).order("created_at"),
  sale.customer_id?supabase.from("gmp_customers").select("name,phone").eq("id",sale.customer_id).eq("organization_id",organization.id).maybeSingle():Promise.resolve({data:null}),
  supabase.from("gmp_stores").select("name,currency,phone,whatsapp").eq("id",sale.store_id).eq("organization_id",organization.id).maybeSingle()
 ]);
 return <div className="dashboard-shell"><DashboardHeader organizationName={organization.name} role={role} planName={planCode}/><main className="container dashboard-main"><section className="dashboard-hero no-print"><div><div className="eyebrow">فاتورة البيع</div><h1 className="dashboard-title">#{sale.invoice_no}</h1><p className="dashboard-subtitle">{store?.name||"—"} · {customer?.name||"عميل نقدي"}</p></div><div className="actions"><PrintButton /><Link className="btn" href="/dashboard/invoices">رجوع للفواتير</Link></div></section><section className="card invoice-print-sheet"><div><h2>{store?.name||organization.name}</h2><div>{store?.phone||"—"}</div></div><hr/><p>فاتورة بيع #{sale.invoice_no} · {new Date(sale.issued_at||sale.created_at).toLocaleString("ar-OM")}</p><p>العميل: {customer?.name||"عميل نقدي"} {customer?.phone||""}</p><div className="stage2-table-wrap"><table><thead><tr><th>الوصف</th><th>الكمية</th><th>الوزن</th><th>سعر الوحدة</th><th>المصنعية</th><th>الخصم</th><th>VAT</th><th>الإجمالي</th></tr></thead><tbody>{(lines||[]).map((l:any)=><tr key={l.id}><td>{l.product_id||"صنف"}</td><td>{l.quantity}</td><td>{l.weight_grams}</td><td><MoneyDisplay value={Number(l.unit_price||0)} currency={store?.currency||"OMR"} locale="ar-OM" maximumFractionDigits={3}/></td><td>{money(l.making_charge)}</td><td>{money(l.discount_amount)}</td><td>{money(l.vat_amount)}</td><td>{money(l.line_total)}</td></tr>)}</tbody></table></div><div style={{maxWidth:360,marginInlineStart:"auto",marginTop:20}}><p>الإجمالي قبل الخصم: {money(sale.subtotal)}</p><p>الخصم: {money(sale.discount_amount)}</p><p>VAT: {money(sale.vat_amount)}</p><h2>الإجمالي: {money(sale.total)} {store?.currency||"OMR"}</h2><p>طريقة الدفع: {sale.payment_method||"—"}</p></div>{sale.notes&&<p>ملاحظات: {sale.notes}</p>}</section></main></div>;
}
function money(v:any){return Number(v||0).toLocaleString("en-OM",{minimumFractionDigits:3,maximumFractionDigits:3});}
