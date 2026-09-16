import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const noStore = { "cache-control": "no-store" };

function subscriptionIsUsable(subscription: { status?: string | null; current_period_end?: string | null } | null) {
  if (!subscription || !["active", "trialing", "grace_period"].includes(subscription.status ?? "")) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503, headers: noStore });
  const body = await request.json().catch(() => null) as { session?: string } | null;
  const session = String(body?.session ?? "").trim();
  if (session.length < 32) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401, headers: noStore });
  const { data } = await admin.from("gmp_screen_sessions").select("id,screen_id,expires_at,revoked_at").eq("session_hash", hash(session)).maybeSingle();
  if (!data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) return NextResponse.json({ ok: false, error: "session_revoked_or_expired" }, { status: 401, headers: noStore });

  const { data: screen } = await admin.from("gmp_screens").select("id,store_id").eq("id", data.screen_id).maybeSingle();
  if (!screen) return NextResponse.json({ ok: false, error: "screen_not_found" }, { status: 404, headers: noStore });
  const { data: store } = await admin.from("gmp_stores").select("organization_id").eq("id", screen.store_id).maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: "store_not_found" }, { status: 404, headers: noStore });
  const { data: subscription } = await admin.from("gmp_subscriptions").select("status,current_period_end").eq("organization_id", store.organization_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!subscriptionIsUsable(subscription)) return NextResponse.json({ ok: false, error: "subscription_required" }, { status: 402, headers: noStore });

  const now = new Date().toISOString();
  const { error } = await admin.from("gmp_screens").update({ status: "connected", last_seen_at: now, updated_at: now }).eq("id", data.screen_id);
  if (error) return NextResponse.json({ ok: false, error: "heartbeat_failed" }, { status: 500, headers: noStore });
  return NextResponse.json({ ok: true, screen_id: data.screen_id, server_time: now }, { headers: noStore });
}
