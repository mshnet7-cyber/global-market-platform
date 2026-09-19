import { readBoundedRequestJson } from "../../../../lib/bounded-body";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getMerchantContext } from "../../../../lib/merchant-access";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

function subscriptionIsUsable(subscription: { status?: string | null; current_period_end?: string | null } | null) {
  if (!subscription || !["active", "trialing", "grace_period"].includes(subscription.status ?? "")) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export async function POST(request: Request) {
  const context = await getMerchantContext();
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  if (!context.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!context.organization || !context.planCode || context.role === "viewer") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  let body: { screen_id?: string } | null;
  try {
    body = await readBoundedRequestJson<{ screen_id?: string }>(request, 64 * 1024);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_json";
    return NextResponse.json({ ok: false, error: message }, { status: message === "request_body_too_large" ? 413 : 400 });
  }
  const screenId = String(body?.screen_id ?? "").trim();
  if (!screenId) return NextResponse.json({ ok: false, error: "invalid_screen" }, { status: 400 });

  const { data: screen } = await admin.from("gmp_screens").select("id,store_id").eq("id", screenId).maybeSingle();
  if (!screen) return NextResponse.json({ ok: false, error: "screen_not_found" }, { status: 404 });
  const { data: store } = await admin.from("gmp_stores").select("organization_id").eq("id", screen.store_id).eq("organization_id", context.organization.id).maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { data: activeSubscription } = await admin.from("gmp_subscriptions").select("status,current_period_end").eq("organization_id", context.organization.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!subscriptionIsUsable(activeSubscription)) return NextResponse.json({ ok: false, error: "subscription_required" }, { status: 402 });

  const now = new Date();
  const nowIso = now.toISOString();
  const expires = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

  const { data, error } = await admin.rpc("gmp_issue_pairing_code", {
    p_screen_id: screenId,
    p_code_hash: hash(code),
    p_expires_at: expires,
    p_now: nowIso,
  });

  if (error || !data?.ok) {
    const message = String(error?.message ?? "");
    if (message.includes("screen_not_found")) return NextResponse.json({ ok: false, error: "screen_not_found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: "code_generation_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, code, expires_at: expires }, { headers: { "cache-control": "no-store" } });
}
