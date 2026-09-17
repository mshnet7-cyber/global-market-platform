import { createHash } from "crypto";
import { createSupabaseAdminClient } from "./supabase/admin";

const providerCodes: Record<string, string> = {
  "Gold API": "gold_api",
  "Current.Gold": "current_gold",
  Frankfurter: "frankfurter",
  "Alpha Vantage": "alpha_vantage",
  EODHD: "eodhd",
  Marketaux: "marketaux",
  "NewsData.io": "newsdata",
};

export function providerCode(name: string) {
  return providerCodes[name.split(" + ")[0]] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export async function recordProviderOutcome(name: string, outcome: "success" | "failure", latencyMs?: number) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const code = providerCode(name);
  try {
    const { data: provider } = await admin.from("gmp_data_providers").select("id").eq("code", code).maybeSingle();
    if (!provider) return;
    const now = new Date().toISOString();
    await admin.from("gmp_provider_status").upsert({
      provider_id: provider.id,
      status: outcome === "success" ? "healthy" : "unhealthy",
      success_count: outcome === "success" ? undefined : 0,
      failure_count: outcome === "failure" ? undefined : 0,
      last_success_at: outcome === "success" ? now : undefined,
      last_failure_at: outcome === "failure" ? now : undefined,
      updated_at: now,
    }, { onConflict: "provider_id" });
    if (latencyMs != null) {
      await admin.from("gmp_audit_logs").insert({
        action: outcome === "success" ? "provider.success" : "provider.failure",
        entity_type: "market_provider",
        metadata: {
          provider: code,
          latency_ms: Math.max(0, Math.round(latencyMs)),
        },
      });
    }
  } catch {
    // Observability must never interrupt the data path.
  }
}

export async function recordAuditEvent(input: {
  action: string;
  organizationId?: string | null;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    const metadata = input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : null;
    await admin.from("gmp_audit_logs").insert({
      action: input.action.slice(0, 160),
      organization_id: input.organizationId ?? null,
      user_id: input.userId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata,
    });
  } catch {
    // Audit failure must never make the primary operation fail.
  }
}

export function safeFingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
