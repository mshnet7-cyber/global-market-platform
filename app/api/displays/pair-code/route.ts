import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

const hash = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  if (!supabase || !admin) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { screen_id?: string } | null;
  const screenId = String(body?.screen_id ?? "").trim();
  if (!screenId) return NextResponse.json({ ok: false, error: "invalid_screen" }, { status: 400 });

  const { data: screen } = await admin.from("gmp_screens").select("id,store_id").eq("id", screenId).maybeSingle();
  if (!screen) return NextResponse.json({ ok: false, error: "screen_not_found" }, { status: 404 });
  const { data: store } = await admin.from("gmp_stores").select("organization_id").eq("id", screen.store_id).maybeSingle();
  if (!store) return NextResponse.json({ ok: false, error: "store_not_found" }, { status: 404 });
  const { data: org } = await admin.from("gmp_organizations").select("id").eq("id", store.organization_id).eq("owner_id", user.id).maybeSingle();
  if (!org) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { data: activeSubscription } = await admin.from("gmp_subscriptions").select("status").eq("organization_id", org.id).in("status", ["active", "grace_period"]).maybeSingle();
  if (!activeSubscription) return NextResponse.json({ ok: false, error: "subscription_required" }, { status: 402 });

  const now = new Date();
  const nowIso = now.toISOString();
  await admin.from("gmp_screen_pairing_codes").update({ consumed_at: nowIso }).eq("screen_id", screenId).is("consumed_at", null);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const expires = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const { error } = await admin.from("gmp_screen_pairing_codes").insert({ screen_id: screenId, code_hash: hash(code), expires_at: expires });
  if (error) return NextResponse.json({ ok: false, error: "code_generation_failed" }, { status: 500 });
  const { error: screenError } = await admin.from("gmp_screens").update({ status: "pairing", updated_at: nowIso }).eq("id", screenId);
  if (screenError) return NextResponse.json({ ok: false, error: "screen_update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, code, expires_at: expires }, { headers: { "cache-control": "no-store" } });
}
