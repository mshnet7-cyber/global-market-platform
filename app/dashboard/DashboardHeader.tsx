import Link from "next/link";

type DashboardHeaderProps = {
  organizationName?: string;
  role?: "owner" | "admin" | "viewer" | string | null;
  planName?: string | null;
};

function roleLabel(role?: string | null) {
  if (role === "owner") return "مالك";
  if (role === "admin") return "مدير";
  if (role === "viewer") return "مشاهد";
  return role || "حساب";
}

export default function DashboardHeader({ organizationName, role, planName }: DashboardHeaderProps) {
  const initials = organizationName?.trim()?.slice(0, 1)?.toUpperCase() || "G";

  return (
    <header className="dashboard-topbar">
      <div className="container dashboard-nav">
        <Link href="/dashboard" className="dashboard-brand" aria-label="Global Market — لوحة المحل">
          GLOBAL <span>MARKET</span>
        </Link>
        <nav className="dashboard-nav-main" aria-label="تنقل لوحة المحل">
          <Link href="/dashboard">الرئيسية</Link>
          <Link href="/dashboard/sales">المبيعات</Link>
          <Link href="/dashboard/inventory">المخزون</Link>
          <Link href="/dashboard/purchases">المشتريات</Link>
          <Link href="/dashboard/accounting">المحاسبة</Link>
          <Link href="/dashboard/reports">التقارير</Link>
          <Link href="/dashboard/operations">ERP</Link>
          <Link href="/dashboard/integrations">التكاملات</Link>
          <Link href="/developers">API</Link>
          <Link href="/directory">المحلات</Link>
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/display">الشاشات</Link>
        </nav>
        <div className="dashboard-user">
          <div className="dashboard-user-text">
            <strong>{organizationName || "Global Market"}</strong>
            <span>{organizationName ? `${roleLabel(role)} · ${planName || "الخطة الحالية"}` : "مساحة التشغيل"}</span>
          </div>
          <div className="dashboard-user-badge" aria-hidden="true">{initials}</div>
        </div>
      </div>
    </header>
  );
}
