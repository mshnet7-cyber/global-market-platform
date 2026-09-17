import { createHash, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "./supabase/admin";

export const API_SCOPES = ["market:read", "alerts:write", "webhooks:write"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function createApiKeyMaterial() {
  const secret = randomBytes(32).toString("base64url");
  const key = "gmp_live_" + secret;
  return {
    key,
    hash: hashApiKey(key),
    prefix: key.slice(0, 18),
  };
}

function readApiKey(request: Request) {
  const direct = request.headers.get("x-gmp-api-key")?.trim();
  if (direct) return direct;
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
  return "";
}

export async function authenticateApiKey(request: Request, scope: ApiScope) {
  const raw = readApiKey(request);
  if (!raw || raw.length < 24) throw new Error("api_key_required");
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("api_unavailable");
  const hash = hashApiKey(raw);
  const { data: apiKey } = await admin
    .from("gmp_api_keys")
    .select("id,organization_id,name,key_prefix,scopes,revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!apiKey || apiKey.revoked_at) throw new Error("api_key_invalid");
  const scopes = Array.isArray(apiKey.scopes) ? apiKey.scopes.map(String) : [];
  if (!scopes.includes(scope)) throw new Error("api_scope_denied");
  const rate = await admin.rpc("gmp_consume_api_rate_limit", {
    p_key_id: apiKey.id,
    p_limit: 120,
    p_window_seconds: 60,
  });
  if (rate.error || rate.data !== true) throw new Error("api_rate_limited");
  await admin.from("gmp_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);
  return {
    id: String(apiKey.id),
    organizationId: apiKey.organization_id ? String(apiKey.organization_id) : null,
    name: String(apiKey.name),
    prefix: String(apiKey.key_prefix),
    scopes,
  };
}

export function apiCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type, x-gmp-api-key",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "cache-control": "no-store",
  };
}
