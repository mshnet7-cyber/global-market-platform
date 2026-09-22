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

const DEMO_COOKIE = "gmp_demo_session";
const DEMO_SECRET_ENV = "GMP_DEMO_SESSION_SECRET";

function demoSecret() {
  return process.env[DEMO_SECRET_ENV] ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

function base64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importSigningKey() {
  const secret = demoSecret();
  if (!secret) return null;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signRole(role: DemoRole) {
  const key = await importSigningKey();
  if (!key) return null;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(role));
  return base64url(new Uint8Array(signature));
}

async function verifyRoleSignature(role: DemoRole, signature: string) {
  const key = await importSigningKey();
  if (!key) return false;
  try {
    return await crypto.subtle.verify("HMAC", key, fromBase64url(signature), new TextEncoder().encode(role));
  } catch {
    return false;
  }
}

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
  const raw = (await cookies()).get(DEMO_COOKIE)?.value ?? "";
  const [roleValue, signature] = raw.split(".");
  const role = roleValue as DemoRole | undefined;
  if (!role || !DEMO_USERS[role] || !signature || !(await verifyRoleSignature(role, signature))) return null;
  return { role, account: DEMO_USERS[role] };
}

export async function setDemoSession(role: DemoRole) {
  if (!isDemoEnvironment()) throw new Error("demo_disabled");
  const signature = await signRole(role);
  if (!signature) throw new Error("demo_secret_missing");
  (await cookies()).set(DEMO_COOKIE, `${role}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearDemoSession() {
  (await cookies()).delete(DEMO_COOKIE);
}
