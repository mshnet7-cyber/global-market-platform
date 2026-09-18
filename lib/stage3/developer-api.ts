import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/admin";

export function requestId() {
  return randomUUID();
}

export function apiV2Headers(requestIdValue: string) {
  return {
    "cache-control": "no-store",
    "content-type": "application/json",
    "x-request-id": requestIdValue,
    "x-api-version": "2",
  };
}

export async function recordApiUsage(input: {
  apiKeyId: string;
  organizationId: string | null;
  requestId: string;
  route: string;
  method: string;
  statusCode: number;
  latencyMs: number;
}) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    await admin.from("gmp_api_usage_events").insert({
      api_key_id: input.apiKeyId,
      organization_id: input.organizationId,
      request_id: input.requestId,
      api_version: "2",
      route: input.route.slice(0, 200),
      method: input.method.slice(0, 12),
      status_code: input.statusCode,
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
    });
  } catch {
    // Usage telemetry must never break the API response.
  }
}
