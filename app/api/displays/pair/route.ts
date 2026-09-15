import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  if (!admin) return new NextResponse("Display pairing is not configured.", { status: 503 });
  const contentType = request.headers.get("content-type") ?? "";
  let code = "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { code?: string } | null;
    code = String(body?.code ?? "").trim();
  } else {
    const form = await request.formData();
    code = String(form.get("code") ?? "").trim();
  }
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400 });
  const codeHash = hash(code);
  const { data: pairing } = await admin.from("gmp_screen_pairing_codes").select("id,screen_id").eq("code_hash", codeHash).is("consumed_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!pairing) return NextResponse.json({ ok: false, error: "invalid_or_expired" }, { status: 400 });
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const { data: session, error } = await admin.from("gmp_screen_sessions").insert({ screen_id: pairing.screen_id, session_hash: hash(sessionToken) }).select("id").single();
  if (error || !session) return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500 });
  const now = new Date().toISOString();
  const { data: consumed } = await admin.from("gmp_screen_pairing_codes").update({ consumed_at: now }).eq("id", pairing.id).is("consumed_at", null).select("id").maybeSingle();
  if (!consumed) { await admin.from("gmp_screen_sessions").delete().eq("id", session.id); return NextResponse.json({ ok: false, error: "code_already_used" }, { status: 409 }); }
  const { error: screenError } = await admin.from("gmp_screens").update({ status: "connected", last_seen_at: now, updated_at: now }).eq("id", pairing.screen_id);
  if (screenError) return NextResponse.json({ ok: false, error: "screen_update_failed" }, { status: 500 });
  if (contentType.includes("application/json")) return NextResponse.json({ ok: true, screen_id: pairing.screen_id, session: sessionToken });
  return NextResponse.redirect(new URL(`/display?paired=1&screen=${pairing.screen_id}`, request.url));
}
