import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const body = await request.json().catch(() => null) as { session?: string } | null;
  const session = String(body?.session ?? "").trim();
  if (session.length < 32) return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 401 });
  const { data } = await admin.from("gmp_screen_sessions").select("id,screen_id,expires_at,revoked_at").eq("session_hash", hash(session)).maybeSingle();
  if (!data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) return NextResponse.json({ ok: false, error: "session_revoked_or_expired" }, { status: 401 });
  const now = new Date().toISOString();
  const { error } = await admin.from("gmp_screens").update({ status: "connected", last_seen_at: now, updated_at: now }).eq("id", data.screen_id);
  if (error) return NextResponse.json({ ok: false, error: "heartbeat_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, screen_id: data.screen_id, server_time: now });
}
