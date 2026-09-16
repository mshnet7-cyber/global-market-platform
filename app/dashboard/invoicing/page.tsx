import { redirect } from "next/navigation";
import Link from "next/link";
import { getMerchantContext } from "../../../lib/merchant-access";
import InvoicingWorkspace from "./InvoicingWorkspace";

export default async function InvoicingPage(){
 const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user) redirect("/login?next=/dashboard/invoicing");
 if(!organization||planCode!=="business") redirect("/pricing");
 if(role==="viewer") redirect("/dashboard");
 return <main className="wrap section"><div className="actions" style={{marginBottom:20}}><Link href="/dashboard" className="btn">لوحة المحل</Link><Link href="/dashboard/compliance" className="btn">الامتثال</Link><Link href="/dashboard/cameras" className="btn">الكاميرات</Link></div><div className="eyebrow">BUSINESS / COUNTRY INVOICING</div><h1>الفوترة الإلكترونية حسب الدولة</h1><p className="hero-copy">إعداد قانوني لكل دولة، موصل مستقل لكل نظام رسمي، وطابور إرسال قابل للتدقيق. لا يتم إرسال أي فاتورة إلى جهة حكومية ما لم يكن الموصل رسميًا ومفعّلًا.</p><InvoicingWorkspace/></main>;
}
