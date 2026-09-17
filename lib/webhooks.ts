import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { createSupabaseAdminClient } from "./supabase/admin";

function encryptionKey() {
  const value = process.env.GMP_WEBHOOK_ENCRYPTION_KEY;
  if (!value) throw new Error("webhook_encryption_not_configured");
  return createHash("sha256").update(value).digest();
}

export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1." + iv.toString("base64url") + "." + tag.toString("base64url") + "." + encrypted.toString("base64url");
}

function decryptWebhookSecret(value: string) {
  const [version, ivPart, tagPart, dataPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("invalid_webhook_secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export function webhookSignature(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
}

export async function dispatchWebhookEvent(organizationId: string | null, eventType: string, payload: Record<string, unknown>) {
  if (!organizationId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    const { data: endpoints } = await admin.from("gmp_webhook_endpoints").select("id,url,event_types,secret_ciphertext").eq("organization_id", organizationId).eq("enabled", true);
    if (!endpoints?.length) return;
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    await Promise.all(endpoints.filter((endpoint: any) => {
      const types = Array.isArray(endpoint.event_types) ? endpoint.event_types.map(String) : [];
      return types.length === 0 || types.includes(eventType);
    }).map(async (endpoint: any) => {
      const eventId = randomUUID();
      try {
        const secret = decryptWebhookSecret(String(endpoint.secret_ciphertext));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        let response: Response;
        try {
          response = await fetch(String(endpoint.url), {
            method: "POST",
            signal: controller.signal,
            headers: {
              "content-type": "application/json",
              "x-gmp-event": eventType,
              "x-gmp-event-id": eventId,
              "x-gmp-timestamp": timestamp,
              "x-gmp-signature": webhookSignature(secret, timestamp, body),
            },
            body,
            cache: "no-store",
          });
        } finally { clearTimeout(timer); }
        await admin.from("gmp_webhook_deliveries").insert({
          endpoint_id: endpoint.id, event_id: eventId, event_type: eventType,
          status_code: response.status, ok: response.ok, attempts: 1,
          delivered_at: response.ok ? new Date().toISOString() : null,
        });
      } catch (error) {
        await admin.from("gmp_webhook_deliveries").insert({
          endpoint_id: endpoint.id, event_id: eventId, event_type: eventType, ok: false, attempts: 1,
          error_message: error instanceof Error ? error.message.slice(0, 500) : "delivery_failed",
        });
      }
    }));
  } catch {
    // Webhook delivery must never break the market path.
  }
}
