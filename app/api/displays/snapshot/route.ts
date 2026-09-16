import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getFreeMetal } from "../../../../lib/free-data";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const noStore = { "cache-control": "no-store" };

function subscriptionIsUsable(subscription: { status: string; current_period_end: string | null } | null) {
  if (!subscription || !["active", "trialing", "grace_period"].includes(subscription.status)) return false;
  if (!subscription.current_period_end) return true;
  return new Date(subscription.current_period_end).getTime() > Date.now();
}

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503, headers: noStore });
  const body = await request.json().catch(() => null) as { session?: string } | null;
  const session = String(body?.session ?? "").trim();
  if (session.length < 32) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401, headers: noStore });

  const { data: device } = await admin
    .from("gmp_screen_sessions")
    .select("screen_id,expires_at,revoked_at")
    .eq("session_hash", hash(session))
    .maybeSingle();
  if (!device || device.revoked_at || (device.expires_at && new Date(device.expires_at).getTime() <= Date.now())) {
    return NextResponse.json({ ok: false, error: "session_revoked_or_expired" }, { status: 401, headers: noStore });
  }

  const { data: screen } = await admin.from("gmp_screens").select("id,store_id,name,template").eq("id", device.screen_id).maybeSingle();
  if (!screen) return NextResponse.json({ ok: false, error: "screen_not_found" }, { status: 404, headers: noStore });
  const { data: store } = await admin
    .from("gmp_stores")
    .select("id,name,currency,timezone,logo_path,phone,whatsapp,organization_id")
    .eq("id", screen.store_id)
    .maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: "store_not_found" }, { status: 404, headers: noStore });

  const { data: subscription } = await admin
    .from("gmp_subscriptions")
    .select("status,current_period_end")
    .eq("organization_id", store.organization_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscriptionIsUsable(subscription)) {
    return NextResponse.json({ ok: false, error: "subscription_required" }, { status: 402, headers: noStore });
  }

  const snapshot = await getFreeMetal(store.currency || "USD", "XAU", "gold");
  if (!snapshot) {
    return NextResponse.json({
      ok: true,
      screen: { id: screen.id, name: screen.name, template: screen.template },
      store: { id: store.id, name: store.name, currency: store.currency, timezone: store.timezone, logo_path: store.logo_path, phone: store.phone, whatsapp: store.whatsapp },
      snapshot: null,
      status: "UNAVAILABLE",
      server_time: new Date().toISOString(),
    }, { headers: noStore });
  }

  const now = new Date().toISOString();
  const { error: screenUpdateError } = await admin
    .from("gmp_screens")
    .update({ last_snapshot_at: snapshot.timestamp ?? now, last_seen_at: now, status: "connected", updated_at: now })
    .eq("id", screen.id);
  if (screenUpdateError) return NextResponse.json({ ok: false, error: "screen_update_failed" }, { status: 500, headers: noStore });

  return NextResponse.json({
    ok: true,
    screen: { id: screen.id, name: screen.name, template: screen.template },
    store: { id: store.id, name: store.name, currency: store.currency, timezone: store.timezone, logo_path: store.logo_path, phone: store.phone, whatsapp: store.whatsapp },
    snapshot,
    status: snapshot.status,
    server_time: now,
  }, { headers: noStore });
}
