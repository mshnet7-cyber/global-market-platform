import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const attempts = new Map<string, { count: number; resetAt: number }>();

function requestKey(request: Request) {
  return hash(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown");
}

function allowAttempt(key: string) {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || row.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (row.count >= 20) return false;
  row.count += 1;
  return true;
}

export async function POST(request: Request) {
  const admin = createSupabaseAdminClient();
  const noStore = { "cache-control": "no-store" };
  if (!admin) return new NextResponse("Display pairing is not configured.", { status: 503, headers: noStore });
  if (!allowAttempt(requestKey(request))) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { ...noStore, "retry-after": "600" } });

  const contentType = request.headers.get("content-type") ?? "";
  let code = "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as { code?: string } | null;
    code = String(body?.code ?? "").trim();
  } else {
    const form = await request.formData();
    code = String(form.get("code") ?? "").trim();
  }
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, error: "invalid_code" }, { status: 400, headers: noStore });

  const now = new Date();
  const { data: pairing } = await admin.from("gmp_screen_pairing_codes")
    .select("id,screen_id")
    .eq("code_hash", hash(code))
    .is("consumed_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!pairing) return NextResponse.json({ ok: false, error: "invalid_or_expired" }, { status: 400, headers: noStore });

  const { data: screen } = await admin.from("gmp_screens").select("id,store_id").eq("id", pairing.screen_id).maybeSingle();
  if (!screen) return NextResponse.json({ ok: false, error: "screen_not_found" }, { status: 404, headers: noStore });
  const { data: store } = await admin.from("gmp_stores").select("organization_id").eq("id", screen.store_id).maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: "store_not_found" }, { status: 404, headers: noStore });
  const { data: subscription } = await admin.from("gmp_subscriptions").select("status").eq("organization_id", store.organization_id).maybeSingle();
  if (!subscription || !["active", "grace_period"].includes(subscription.status)) return NextResponse.json({ ok: false, error: "subscription_required" }, { status: 402, headers: noStore });

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: session, error: sessionError } = await admin.from("gmp_screen_sessions")
    .insert({ screen_id: pairing.screen_id, session_hash: hash(sessionToken), expires_at: expiresAt })
    .select("id")
    .single();
  if (sessionError || !session) return NextResponse.json({ ok: false, error: "session_failed" }, { status: 500, headers: noStore });

  const { data: consumed } = await admin.from("gmp_screen_pairing_codes")
    .update({ consumed_at: now.toISOString() })
    .eq("id", pairing.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();
  if (!consumed) {
    await admin.from("gmp_screen_sessions").delete().eq("id", session.id);
    return NextResponse.json({ ok: false, error: "code_already_used" }, { status: 409, headers: noStore });
  }

  const { error: screenError } = await admin.from("gmp_screens").update({ status: "connected", last_seen_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", pairing.screen_id);
  if (screenError) {
    await admin.from("gmp_screen_sessions").delete().eq("id", session.id);
    return NextResponse.json({ ok: false, error: "screen_update_failed" }, { status: 500, headers: noStore });
  }

  if (contentType.includes("application/json")) return NextResponse.json({ ok: true, screen_id: pairing.screen_id, session: sessionToken, expires_at: expiresAt }, { headers: noStore });
  return NextResponse.redirect(new URL(`/display?paired=1&screen=${pairing.screen_id}`, request.url));
}
