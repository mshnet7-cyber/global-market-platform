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

const navItems = [
  ["/dashboard", "الرئيسية"],
  ["/dashboard/sales", "المبيعات"],
  ["/dashboard/inventory", "المخزون"],
  ["/dashboard/purchases", "المشتريات"],
  ["/dashboard/accounting", "المحاسبة"],
  ["/dashboard/reports", "التقارير"],
  ["/dashboard/operations", "ERP"],
  ["/dashboard/integrations", "التكاملات"],
  ["/dashboard/api-keys", "API Keys"],
  ["/developers", "API"],
  ["/directory", "المحلات"],
  ["/marketplace", "Marketplace"],
  ["/display", "الشاشات"],
] as const;

export default function DashboardHeader({ organizationName, role, planName }: DashboardHeaderProps) {
  const initials = organizationName?.trim()?.slice(0, 1)?.toUpperCase() || "G";

  return (
    <header className="dashboard-topbar">
      <div className="container dashboard-nav">
        <Link href="/dashboard" className="dashboard-brand" aria-label="Global Market — لوحة المحل">
          GLOBAL <span>MARKET</span>
        </Link>
        <details className="dashboard-mobile-menu">
          <summary aria-label="فتح تنقل لوحة المحل">☰</summary>
          <nav aria-label="تنقل الهاتف">
            {navItems.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
            <Link href="/dashboard/account">الحساب</Link>
          </nav>
        </details>
        <nav className="dashboard-nav-main" aria-label="تنقل لوحة المحل">
          {navItems.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="dashboard-user">
          <div className="dashboard-user-text">
            <strong>{organizationName || "Global Market"}</strong>
            <span>{organizationName ? roleLabel(role) + " · " + (planName || "الخطة الحالية") : "مساحة التشغيل"}</span>
          </div>
          <Link href="/dashboard/account" className="dashboard-user-badge" aria-label="الحساب">{initials}</Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="btn btn-ghost dashboard-logout">خروج</button>
          </form>
        </div>
      </div>
    </header>
  );
}
