import { getMerchantContext, type MerchantPlanCode, type MerchantRole } from "./merchant-access";

export type Stage2Permission =
  | "directory.read"
  | "directory.write"
  | "marketplace.read"
  | "marketplace.write"
  | "erp.read"
  | "erp.write"
  | "pos.write"
  | "inventory.write"
  | "staff.read"
  | "staff.write"
  | "displays.read"
  | "displays.write"
  | "dooh.read"
  | "dooh.write"
  | "admin.read";

const OWNER_ALL = new Set<Stage2Permission>([
  "directory.read","directory.write","marketplace.read","marketplace.write",
  "erp.read","erp.write","pos.write","inventory.write","staff.read","staff.write",
  "displays.read","displays.write","dooh.read","dooh.write"
]);

const ADMIN_DEFAULT = new Set<Stage2Permission>([
  "directory.read","directory.write","marketplace.read","marketplace.write",
  "erp.read","erp.write","pos.write","inventory.write","staff.read","staff.write",
  "displays.read","displays.write","dooh.read","dooh.write"
]);

const VIEWER_DEFAULT = new Set<Stage2Permission>([
  "directory.read","marketplace.read","erp.read","staff.read","displays.read","dooh.read"
]);

export async function getStage2Access() {
  const context = await getMerchantContext();
  if (!context.user || !context.organization || !context.role || !context.planCode) {
    return { ...context, permissions: new Set<Stage2Permission>() };
  }
  const base = context.role === "owner" ? OWNER_ALL : context.role === "admin" ? ADMIN_DEFAULT : VIEWER_DEFAULT;
  const { data } = await context.supabase.from("gmp_member_permissions")
    .select("permissions")
    .eq("organization_id", context.organization.id)
    .eq("user_id", context.user.id)
    .maybeSingle();
  const overrides = new Set<Stage2Permission>();
  const raw = data?.permissions;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, enabled] of Object.entries(raw as Record<string, unknown>)) {
      if (enabled === true && base.has(key as Stage2Permission)) overrides.add(key as Stage2Permission);
    }
  }
  const permissions = new Set(base);
  for (const key of Object.keys(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {})) {
    const p = key as Stage2Permission;
    if (raw[p] === false) permissions.delete(p);
  }
  for (const p of overrides) permissions.add(p);
  return { ...context, permissions };
}

export async function requireStage2Permission(permission: Stage2Permission, plans: MerchantPlanCode[] = ["starter","pro","business"]) {
  const access = await getStage2Access();
  if (!access.user || !access.organization || !access.role || !access.planCode || !plans.includes(access.planCode) || !access.permissions.has(permission)) {
    throw new Error("stage2_forbidden");
  }
  return access as typeof access & {
    user: NonNullable<typeof access.user>;
    organization: NonNullable<typeof access.organization>;
    role: MerchantRole;
    planCode: MerchantPlanCode;
  };
}
