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

  const now = new Date();
  const weekday = now.getUTCDay();
  const { data: schedules } = await admin.from("gmp_display_schedules")
    .select("id,content_id,starts_at,ends_at,days_of_week,enabled")
    .eq("screen_id", screen.id).eq("store_id", store.id).eq("enabled", true)
    .or("starts_at.is.null,starts_at.lte." + now.toISOString())
    .or("ends_at.is.null,ends_at.gte." + now.toISOString())
    .order("starts_at", { ascending: true }).limit(100);
  const activeSchedules = (schedules ?? []).filter((s:any) => !Array.isArray(s.days_of_week) || !s.days_of_week.length || s.days_of_week.includes(weekday));
  const contentIds = activeSchedules.map((s:any) => s.content_id);
  const { data: contentRows } = contentIds.length ? await admin.from("gmp_display_content")
    .select("id,content_type,title,body,media_path,payload,priority,active")
    .in("id", contentIds).eq("store_id", store.id).eq("active", true).order("priority", { ascending: false })
    : { data: [] as any[] };
  const { data: placements } = await admin.from("gmp_ad_placements")
    .select("id,campaign_id,creative_id,status,starts_at,ends_at,weight")
    .eq("screen_id", screen.id).in("status", ["live","scheduled"])
    .or("starts_at.is.null,starts_at.lte." + now.toISOString())
    .or("ends_at.is.null,ends_at.gte." + now.toISOString()).limit(100);
  const campaignIds = (placements ?? []).map((p:any)=>p.campaign_id);
  const creativeIds = (placements ?? []).map((p:any)=>p.creative_id).filter(Boolean);
  const { data: campaigns } = campaignIds.length ? await admin.from("gmp_ad_campaigns")
    .select("id,title,body,image_path,target_url,advertiser_name,status,placement").in("id",campaignIds).in("status",["approved","active"]) : { data: [] as any[] };
  const { data: creatives } = creativeIds.length ? await admin.from("gmp_ad_creatives")
    .select("id,name,creative_type,asset_path,target_url,status").in("id",creativeIds).eq("status","approved") : { data: [] as any[] };
  const campaignMap = new Map((campaigns ?? []).map((x:any)=>[x.id,x]));
  const creativeMap = new Map((creatives ?? []).map((x:any)=>[x.id,x]));
  const ads = (placements ?? []).map((p:any)=>({ placement:p, campaign:campaignMap.get(p.campaign_id)||null, creative:creativeMap.get(p.creative_id)||null }))
    .filter((x:any)=>x.campaign || x.creative);

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

  const nowIso = new Date().toISOString();
  const { error: screenUpdateError } = await admin
    .from("gmp_screens")
    .update({ last_snapshot_at: snapshot.timestamp ?? nowIso, last_seen_at: nowIso, status: "connected", updated_at: now })
    .eq("id", screen.id);
  if (screenUpdateError) return NextResponse.json({ ok: false, error: "screen_update_failed" }, { status: 500, headers: noStore });

  return NextResponse.json({
    ok: true,
    screen: { id: screen.id, name: screen.name, template: screen.template },
    store: { id: store.id, name: store.name, currency: store.currency, timezone: store.timezone, logo_path: store.logo_path, phone: store.phone, whatsapp: store.whatsapp },
    snapshot,
    status: snapshot.status,
    server_time: nowIso,
  }, { headers: noStore });
}
