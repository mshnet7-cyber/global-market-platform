import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getFreeMetal } from "../../../../lib/free-data";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { session?: string } | null;
  const session = String(body?.session ?? "").trim();
  if (session.length < 32) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401, headers: { "cache-control": "no-store" } });

  const { data: device } = await admin.from("gmp_screen_sessions").select("screen_id,expires_at,revoked_at").eq("session_hash", hash(session)).maybeSingle();
  if (!device || device.revoked_at || (device.expires_at && new Date(device.expires_at).getTime() <= Date.now())) {
    return NextResponse.json({ ok: false, error: "session_revoked_or_expired" }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const { data: screen } = await admin.from("gmp_screens").select("id,store_id,name,template").eq("id", device.screen_id).maybeSingle();
  if (!screen) return NextResponse.json({ ok: false, error: "screen_not_found" }, { status: 404 });
  const { data: store } = await admin.from("gmp_stores").select("id,name,currency,timezone,logo_path,phone,whatsapp").eq("id", screen.store_id).maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: "store_not_found" }, { status: 404 });

  const snapshot = await getFreeMetal(store.currency || "OMR", "XAU", "gold");
  if (!snapshot) {
    return NextResponse.json({
      ok: true,
      screen: { id: screen.id, name: screen.name, template: screen.template },
      store: { id: store.id, name: store.name, currency: store.currency, timezone: store.timezone, logo_path: store.logo_path, phone: store.phone, whatsapp: store.whatsapp },
      snapshot: null,
      status: "UNAVAILABLE",
      server_time: new Date().toISOString(),
    }, { headers: { "cache-control": "no-store" } });
  }

  const now = new Date().toISOString();
  await admin.from("gmp_screens").update({ last_snapshot_at: snapshot.timestamp ?? now, last_seen_at: now, status: "connected", updated_at: now }).eq("id", screen.id);
  return NextResponse.json({
    ok: true,
    screen: { id: screen.id, name: screen.name, template: screen.template },
    store: { id: store.id, name: store.name, currency: store.currency, timezone: store.timezone, logo_path: store.logo_path, phone: store.phone, whatsapp: store.whatsapp },
    snapshot,
    status: snapshot.status,
    server_time: now,
  }, { headers: { "cache-control": "no-store" } });
}
