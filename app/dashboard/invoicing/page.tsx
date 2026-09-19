import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import InvoicingWorkspace from "./InvoicingWorkspace";
import DashboardHeader from "../DashboardHeader";

export default async function InvoicingPage(){
 const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user) redirect("/login?next=/dashboard/invoicing");
 if(!organization||planCode!=="business") redirect("/pricing");
 if(role==="viewer") redirect("/dashboard");
 return <div className="dashboard-shell"><DashboardHeader organizationName={organization.name} role={role} planName="الكاملة"/><main className="wrap section dashboard-module-page invoicing-page"><div className="eyebrow">الأعمال / الفوترة حسب الدولة</div><h1>الفوترة الإلكترونية حسب الدولة</h1><p className="hero-copy">إعداد قانوني لكل دولة، موصل مستقل لكل نظام رسمي، وطابور إرسال قابل للتدقيق. لا يتم إرسال أي فاتورة إلى جهة حكومية ما لم يكن الموصل رسميًا ومفعّلًا.</p><div className="module-context"><span>الخطة الكاملة</span><span>طابور إرسال قابل للتدقيق</span><span>الموصلات الرسمية فقط</span></div><InvoicingWorkspace/></main></div>;
}
