import { cookies } from "next/headers";

export type DemoRole = "platform_admin" | "shop_owner";

const DEMO_USERS: Record<DemoRole, { email: string; password: string; userId: string; name: string }> = {
  platform_admin: {
    email: "admin@accounts.omangold.local",
    password: "GMP-Demo-Admin-2026!",
    userId: "4fb2162b-0b37-4680-a871-68508dc11bac",
    name: "Global Market Demo Admin",
  },
  shop_owner: {
    email: "sharaf@accounts.omangold.local",
    password: "GMP-Demo-Shop-2026!",
    userId: "638b3213-67c6-4410-9e76-e44bbb7734f1",
    name: "Global Market Demo Shop",
  },
};

const DEMO_COOKIE = "gmp_demo_role";

export function isDemoEnvironment() {
  return process.env.VERCEL_ENV === "preview";
}

export function getDemoCredentials(role: DemoRole) {
  return DEMO_USERS[role];
}

export function matchDemoCredentials(email: string, password: string): DemoRole | null {
  if (!isDemoEnvironment()) return null;
  const normalized = email.trim().toLowerCase();
  for (const [role, account] of Object.entries(DEMO_USERS) as [DemoRole, typeof DEMO_USERS[DemoRole]][]) {
    if (account.email === normalized && account.password === password) return role;
  }
  return null;
}

export async function getDemoSession(): Promise<{ role: DemoRole; account: ReturnType<typeof getDemoCredentials> } | null> {
  if (!isDemoEnvironment()) return null;
  const role = (await cookies()).get(DEMO_COOKIE)?.value as DemoRole | undefined;
  if (!role || !DEMO_USERS[role]) return null;
  return { role, account: DEMO_USERS[role] };
}

export async function setDemoSession(role: DemoRole) {
  if (!isDemoEnvironment()) throw new Error("demo_disabled");
  (await cookies()).set(DEMO_COOKIE, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearDemoSession() {
  (await cookies()).delete(DEMO_COOKIE);
}
