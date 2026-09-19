import { NextResponse } from "next/server";
import { getMerchantContext } from "../../../../lib/merchant-access";
import { encryptWebhookSecret, validateWebhookUrl } from "../../../../lib/webhooks";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
const EVENT_TYPES = ["market.alert.triggered"] as const;

async function guard() {
  const context = await getMerchantContext();
  if (!context.user || !context.organization || !context.planCode || !["pro", "business"].includes(context.planCode) || context.role === "viewer") {
    throw new Error("merchant_plan_required");
  }
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("service_not_configured");
  return { ...context, admin };
}

export async function GET() {
  try {
    const { organization, admin } = await guard();
    const { data, error } = await admin.from("gmp_webhook_endpoints")
      .select("id,url,event_types,enabled,secret_hint,created_at,updated_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return json({ endpoints: data ?? [], supported_events: EVENT_TYPES });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return json({ error: message }, message === "merchant_plan_required" ? 403 : 500);
  }
}

export async function POST(request: Request) {
  try {
    const { organization, admin } = await guard();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const url = String(body?.url ?? "").trim();
    const secret = String(body?.signing_secret ?? "");
    const events = Array.isArray(body?.event_types) ? body.event_types.map(String) : ["market.alert.triggered"];
    if (!(await validateWebhookUrl(url))) return json({ error: "invalid_webhook_destination" }, 400);
    if (secret.length < 16 || secret.length > 512) return json({ error: "invalid_webhook_secret" }, 400);
    if (!events.length || events.some((event) => !EVENT_TYPES.includes(event as typeof EVENT_TYPES[number]))) return json({ error: "unsupported_event_type" }, 400);

    const { data, error } = await admin.from("gmp_webhook_endpoints").insert({
      organization_id: organization.id,
      url,
      event_types: events,
      secret_ciphertext: encryptWebhookSecret(secret),
      secret_hint: secret.slice(-4),
      enabled: true,
    }).select("id,url,event_types,enabled,secret_hint,created_at").single();
    if (error) throw new Error(error.message);
    return json({ success: true, endpoint: data }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return json({ error: message }, message === "merchant_plan_required" ? 403 : 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const { organization, admin } = await guard();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const id = String(body?.id ?? "");
    if (!id || typeof body?.enabled !== "boolean") return json({ error: "invalid_request" }, 400);
    const { data, error } = await admin.from("gmp_webhook_endpoints")
      .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organization.id)
      .select("id,url,event_types,enabled,secret_hint,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return json({ success: true, endpoint: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return json({ error: message }, message === "merchant_plan_required" ? 403 : 500);
  }
}
