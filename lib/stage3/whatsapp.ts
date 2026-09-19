import { createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationState } from "./types";
import { readBoundedText } from "./provider-http";

function cfg() {
  return {
    provider: process.env.GMP_WHATSAPP_PROVIDER?.trim() || null,
    messagesUrl: process.env.GMP_WHATSAPP_MESSAGES_URL?.trim().replace(/\/$/, "") || null,
    accessToken: process.env.GMP_WHATSAPP_ACCESS_TOKEN?.trim() || null,
    senderId: process.env.GMP_WHATSAPP_SENDER_ID?.trim() || null,
    webhookSecret: process.env.GMP_WHATSAPP_WEBHOOK_SECRET?.trim() || null,
    approved: process.env.GMP_WHATSAPP_APPROVED === "true",
  };
}

export function getWhatsAppStatus() {
  const c = cfg();
  const state: IntegrationState = c.messagesUrl && c.accessToken && c.senderId && c.approved ? "live" : "integration_ready";
  return { state, provider: c.provider, reason: state === "live" ? undefined : "provider_credentials_or_commercial_approval_not_configured" };
}

export type WhatsAppMessageInput = {
  to: string;
  messageType: "template" | "document" | "text";
  templateName?: string;
  languageCode?: string;
  parameters?: Array<string | number>;
  documentUrl?: string;
  fileName?: string;
  caption?: string;
  text?: string;
  clientReference?: string | null;
};

export async function sendWhatsAppMessage(input: WhatsAppMessageInput) {
  const c = cfg();
  if (!c.messagesUrl || !c.accessToken || !c.senderId || !c.approved) throw new Error("whatsapp_not_configured");
  if (input.messageType === "template" && !input.templateName) throw new Error("whatsapp_template_required");
  if (input.messageType === "document" && !input.documentUrl) throw new Error("whatsapp_document_required");
  if (input.messageType === "text" && !input.text) throw new Error("whatsapp_text_required");
  const body: Record<string, unknown> = {
    sender_id: c.senderId,
    recipient: input.to,
    type: input.messageType,
    client_reference: input.clientReference ?? null,
  };
  if (input.messageType === "template") body.template = { name: input.templateName, language: input.languageCode ?? "ar", parameters: input.parameters ?? [] };
  if (input.messageType === "document") body.document = { url: input.documentUrl, filename: input.fileName ?? "invoice.pdf", caption: input.caption ?? "" };
  if (input.messageType === "text") body.text = input.text;
  let providerUrl: URL;
  try { providerUrl = new URL(c.messagesUrl); } catch { throw new Error("whatsapp_endpoint_invalid"); }
  if (providerUrl.protocol !== "https:" || providerUrl.username || providerUrl.password) throw new Error("whatsapp_endpoint_invalid");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(providerUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${c.accessToken}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
      redirect: "error",
    });
    const raw = await readBoundedText(response);
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { data = { raw: raw.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`whatsapp_provider_http_${response.status}`);
  return data;
}

export type WhatsAppTemplateMessage = {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: Array<string | number>;
  clientReference?: string | null;
};

export async function sendWhatsAppTemplate(input: WhatsAppTemplateMessage) {
  return sendWhatsAppMessage({
    to: input.to,
    messageType: "template",
    templateName: input.templateName,
    languageCode: input.languageCode,
    parameters: input.parameters,
    clientReference: input.clientReference,
  });
}

export function verifyWhatsAppWebhook(body: string, signature: string | null) {
  const secret = cfg().webhookSecret;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = signature.replace(/^sha256=/i, "");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
