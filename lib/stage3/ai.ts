import { createHash } from "node:crypto";
import type { IntegrationState } from "./types";

type AiResponse = {
  output?: unknown;
  data?: unknown;
  text?: string;
  confidence?: number;
  [key: string]: unknown;
};

function cfg() {
  return {
    provider: process.env.GMP_AI_PROVIDER?.trim() || null,
    baseUrl: process.env.GMP_AI_BASE_URL?.trim().replace(/\/$/, "") || null,
    apiKey: process.env.GMP_AI_API_KEY?.trim() || null,
    model: process.env.GMP_AI_MODEL?.trim() || null,
  };
}

export function getAiStatus(): { state: IntegrationState; provider: string | null; model: string | null; reason?: string } {
  const c = cfg();
  if (!c.provider || !c.baseUrl || !c.apiKey || !c.model) {
    return { state: "integration_ready", provider: c.provider, model: c.model, reason: "provider_credentials_not_configured" };
  }
  return { state: "live", provider: c.provider, model: c.model };
}

async function invoke(path: string, payload: Record<string, unknown>): Promise<AiResponse> {
  const c = cfg();
  if (!c.baseUrl || !c.apiKey || !c.model) throw new Error("ai_not_configured");
  const response = await fetch(`${c.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${c.apiKey}`,
      "x-gmp-model": c.model,
    },
    body: JSON.stringify({ model: c.model, ...payload }),
    cache: "no-store",
  });
  const raw = await response.text();
  let data: AiResponse = {};
  try { data = JSON.parse(raw) as AiResponse; } catch { data = { text: raw.slice(0, 10000) }; }
  if (!response.ok) throw new Error(`ai_provider_http_${response.status}`);
  return data;
}

export async function extractDocumentFields(input: {
  sourceUrl: string;
  contentType?: string | null;
  language?: string | null;
  documentType?: string | null;
}) {
  const fingerprint = createHash("sha256").update(input.sourceUrl).digest("hex");
  const response = await invoke("/ocr", {
    operation: "document_ocr",
    source_url: input.sourceUrl,
    content_type: input.contentType ?? null,
    language: input.language ?? null,
    document_type: input.documentType ?? "invoice",
    source_fingerprint: fingerprint,
    response_format: "structured_json",
  });
  return response;
}

export async function askCopilot(input: {
  question: string;
  context: Record<string, unknown>;
}) {
  return invoke("/chat", {
    operation: "merchant_copilot",
    input: input.question.slice(0, 4000),
    context: input.context,
    response_format: "structured_json",
  });
}
