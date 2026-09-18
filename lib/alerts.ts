import { createSupabaseAdminClient } from "./supabase/admin";
import { recordAuditEvent } from "./provider-observability";
import { dispatchWebhookEvent } from "./webhooks";

type EvaluatedMarket = {
  instrumentCode: string;
  value: number | null;
  changePercent?: number | null;
  providerCode?: string | null;
  providerStatus?: string | null;
  providerName?: string | null;
  currency?: string | null;
};

function triggered(rule: any, market: EvaluatedMarket) {
  switch (rule.rule_type) {
    case "price_above": return market.value != null && rule.threshold != null && market.value >= Number(rule.threshold);
    case "price_below": return market.value != null && rule.threshold != null && market.value <= Number(rule.threshold);
    case "change_pct_above": return market.changePercent != null && rule.threshold != null && market.changePercent >= Number(rule.threshold);
    case "change_pct_below": return market.changePercent != null && rule.threshold != null && market.changePercent <= Number(rule.threshold);
    case "source_unavailable": return market.providerStatus === "unhealthy" || market.providerStatus === "UNAVAILABLE";
    default: return false;
  }
}

export async function evaluateMarketAlerts(market: EvaluatedMarket) {
  const admin = createSupabaseAdminClient();
  if (!admin) return 0;
  try {
    let query = admin.from("gmp_market_alert_rules").select("*").eq("active", true).limit(500);
    if (market.instrumentCode) query = query.eq("instrument_code", market.instrumentCode);
    const { data: rules } = await query;
    if (!rules?.length) return 0;
    let fired = 0;
    for (const rule of rules) {
      if (!triggered(rule, market)) continue;
      const cooldownMinutes = Math.max(1, Number(rule.cooldown_minutes ?? 30));
      const { data: claimed, error: claimError } = await admin.rpc("gmp_claim_market_alert", { p_rule_id: rule.id, p_cooldown_minutes: cooldownMinutes, p_now: new Date().toISOString() });
      if (claimError || claimed !== true) continue;
      const title = "تنبيه السوق: " + market.instrumentCode;
      const body = rule.rule_type === "source_unavailable"
        ? "مصدر البيانات أصبح غير متاح أو غير موثوق: " + (market.providerName ?? market.providerCode ?? "unknown")
        : "تحقق شرط " + rule.rule_type + " عند " + (market.value ?? market.changePercent ?? "—");
      await admin.from("gmp_notifications").insert({
        user_id: rule.user_id,
        type: "market_alert",
        title,
        body,
      });
      await recordAuditEvent({
        action: "market.alert.triggered",
        organizationId: rule.organization_id,
        userId: rule.user_id,
        entityType: "market_alert_rule",
        entityId: rule.id,
        metadata: { instrument: market.instrumentCode, rule_type: rule.rule_type },
      });
      await dispatchWebhookEvent(rule.organization_id, "market.alert.triggered", {
        rule_id: rule.id,
        instrument_code: market.instrumentCode,
        value: market.value,
        change_percent: market.changePercent ?? null,
        provider: market.providerName ?? market.providerCode ?? null,
      });
      fired += 1;
    }
    return fired;
  } catch {
    return 0;
  }
}
