import { createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationState } from "./types";

function cfg() {
  return {
    provider: process.env.GMP_WHATSAPP_PROVIDER?.trim() || null,
    messagesUrl: process.env.GMP_WHATSAPP_MESSAGES_URL?.trim().replace(/\/$/, "") || null,
    accessToken: process.env.GMP_WHATSAPP_ACCESS_TOKEN?.trim() || null,
    senderId: process.env.GMP_WHATSAPP_SENDER_ID?.trim() || null,
    webhookSecret: process.env.GMP_WHATSAPP_WEBHOOK_SECRET?.trim() || null,
  };
}

export function getWhatsAppStatus() {
  const c = cfg();
  const state: IntegrationState = c.messagesUrl && c.accessToken && c.senderId ? "live" : "integration_ready";
  return { state, provider: c.provider, reason: state === "live" ? undefined : "provider_credentials_not_configured" };
}

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: Array<string | number>;
  clientReference?: string | null;
};

export async function sendWhatsAppTemplate(input: WhatsAppTemplateMessage) {
  const c = cfg();
  if (!c.messagesUrl || !c.accessToken || !c.senderId) throw new Error("whatsapp_not_configured");
  const response = await fetch(c.messagesUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${c.accessToken}`,
    },
    body: JSON.stringify({
      sender_id: c.senderId,
      recipient: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: input.languageCode ?? "ar",
        parameters: input.parameters ?? [],
      },
      client_reference: input.clientReference ?? null,
    }),
    cache: "no-store",
  });
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { data = { raw: raw.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`whatsapp_provider_http_${response.status}`);
  return data;
}

export function verifyWhatsAppWebhook(body: string, signature: string | null) {
  const secret = cfg().webhookSecret;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = signature.replace(/^sha256=/i, "");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
