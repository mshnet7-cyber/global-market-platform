import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import ComplianceWorkspace from "./ComplianceWorkspace";
import DashboardHeader from "../DashboardHeader";

export default async function CompliancePage(){
 const {supabase,user,organization,role,planCode}=await getMerchantContext();
 if(!supabase||!user) redirect("/login?next=/dashboard/compliance");
 if(!organization||planCode!=="business") redirect("/pricing");
 if(role==="viewer") redirect("/dashboard");
 return <div className="dashboard-shell"><DashboardHeader organizationName={organization.name} role={role} planName="الكاملة"/><main className="wrap section dashboard-module-page compliance-page"><div className="eyebrow">BUSINESS / COMPLIANCE</div><h1>الامتثال وتوثيق العمليات</h1><p className="hero-copy">فتح ومتابعة حالات مراجعة لشراء الذهب والبيع والإصلاح والعملاء، مع سجل أحداث وتجهيز للربط الرسمي عند توفر واجهة حكومية أو مزود معتمد.</p><div className="module-context"><span>الخطة الكاملة</span><span>سجل أحداث قابل للمراجعة</span><span>صلاحيات حسب الدور</span></div><ComplianceWorkspace/></main></div>;
}
