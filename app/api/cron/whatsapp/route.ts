import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getWhatsAppStatus, sendWhatsAppMessage } from "../../../../lib/stage3/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: { "cache-control": "no-store" },
});

function retryDelay(attempt: number) {
  return Math.min(24 * 60 * 60_000, Math.pow(2, Math.max(0, attempt - 1)) * 30_000 + Math.floor(Math.random() * 5_000));
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.GMP_CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) return json({ error: "unauthorized" }, 401);

  const status = getWhatsAppStatus();
  if (status.state !== "live") return json({ error: "whatsapp_not_configured", integration_state: "integration_ready" }, 503);

  const admin = createSupabaseAdminClient();
  if (!admin) return json({ error: "service_not_configured" }, 503);

  const { data, error } = await admin.rpc("gmp_claim_due_whatsapp_messages", { p_limit: 25 });
  if (error) return json({ error: error.message }, 503);

  let processed = 0;
  let sent = 0;
  for (const row of data ?? []) {
    processed++;
    const payload = row.payload && typeof row.payload === "object" ? row.payload as Record<string, unknown> : {};
    const type = ["template", "document", "text"].includes(String(row.message_type)) ? String(row.message_type) as "template" | "document" | "text" : "template";
    try {
      const result = await sendWhatsAppMessage({
        to: String(row.recipient),
        messageType: type,
        templateName: row.template_name ? String(row.template_name) : undefined,
        languageCode: String(payload.language_code ?? "ar"),
        parameters: Array.isArray(payload.parameters) ? payload.parameters.filter((v) => typeof v === "string" || typeof v === "number") as Array<string | number> : [],
        documentUrl: payload.document_url ? String(payload.document_url) : undefined,
        fileName: payload.file_name ? String(payload.file_name) : undefined,
        caption: payload.caption ? String(payload.caption) : undefined,
        text: payload.text ? String(payload.text) : undefined,
        clientReference: String(row.id),
      });
      const nextAttempts = Number(row.attempts ?? 0) + 1;
      await admin.from("gmp_whatsapp_messages").update({
        status: "sent",
        provider: status.provider,
        external_id: String((result as any)?.message_id ?? (result as any)?.id ?? "") || null,
        attempts: nextAttempts,
        next_retry_at: null,
        sent_at: row.sent_at ?? new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      sent++;
    } catch (error) {
      const attempt = Number(row.attempts ?? 0) + 1;
      const terminal = attempt >= 8;
      await admin.from("gmp_whatsapp_messages").update({
        status: "failed",
        provider: status.provider,
        attempts: attempt,
        next_retry_at: terminal ? null : new Date(Date.now() + retryDelay(attempt)).toISOString(),
        last_error: error instanceof Error ? error.message.slice(0, 500) : "provider_delivery_failed",
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
    }
  }

  return json({ success: true, processed, sent, failed: processed - sent });
}
