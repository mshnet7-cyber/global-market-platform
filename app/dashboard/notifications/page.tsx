import { redirect } from "next/navigation";
import Link from "next/link";
import { getMerchantContext } from "../../../lib/merchant-access";
import DashboardHeader from "../DashboardHeader";
import NotificationsWorkspace from "./NotificationsWorkspace";

export default async function NotificationsPage(){
  const { supabase, user, organization, role, planCode } = await getMerchantContext();
  if(!supabase || !user) redirect("/login?next=/dashboard/notifications");
  if(!organization || !role) redirect("/signup?error=account_setup");
  const { data } = await supabase.from("gmp_notifications").select("id,type,title,body,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
  return <div className="dashboard-shell">
    <DashboardHeader organizationName={organization.name} role={role} planName={planCode||"لا توجد خطة فعالة"} />
    <main className="wrap section dashboard-module-page">
      <div className="eyebrow">NOTIFICATIONS</div>
      <h1>الإشعارات</h1>
      <p className="hero-copy">تنبيهات السوق والأحداث المرتبطة بحسابك. غير المقروء يبقى واضحًا حتى تراجعه.</p>
      <NotificationsWorkspace initialNotifications={data??[]} />
      <div className="actions" style={{marginTop:16}}><Link className="btn" href="/dashboard">العودة للوحة</Link><Link className="btn" href="/dashboard/integrations">التكاملات</Link></div>
    </main>
  </div>;
}
