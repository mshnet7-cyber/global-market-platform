import { redirect } from "next/navigation";
import Link from "next/link";
import { getMerchantContext } from "../../../lib/merchant-access";
import ComplianceWorkspace from "./ComplianceWorkspace";

export default async function CompliancePage(){
 const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user) redirect("/login?next=/dashboard/compliance");
 if(!organization||planCode!=="business") redirect("/pricing");
 if(role==="viewer") redirect("/dashboard");
 return <main className="wrap section"><div className="actions" style={{marginBottom:20}}><Link href="/dashboard" className="btn">لوحة المحل</Link><Link href="/dashboard/cameras" className="btn">الكاميرات</Link><Link href="/dashboard/invoicing" className="btn">الفوترة حسب الدولة</Link></div><div className="eyebrow">BUSINESS / COMPLIANCE</div><h1>الامتثال وتوثيق العمليات</h1><p className="hero-copy">فتح ومتابعة حالات مراجعة لشراء الذهب والبيع والإصلاح والعملاء، مع سجل أحداث وتجهيز للربط الرسمي عند توفر واجهة حكومية أو مزود معتمد.</p><ComplianceWorkspace/></main>;
}
