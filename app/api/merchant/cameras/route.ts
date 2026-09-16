import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

const protocols = new Set(["onvif", "rtsp", "http", "https", "webrtc", "hls", "other"]);
const kinds = new Set(["hls", "http", "https", "mp4", "webrtc"]);
const types = new Set(["ip", "nvr", "dvr", "other"]);

function safeUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:", "rtsp:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

async function validStore(supabase: any, organizationId: string, storeId: unknown) {
  if (!storeId) return true;
  const { data } = await supabase.from("gmp_stores").select("id,branch_id").eq("id", String(storeId)).eq("organization_id", organizationId).maybeSingle();
  return data ?? null;
}

async function validBranch(supabase: any, organizationId: string, branchId: unknown) {
  if (!branchId) return true;
  const { data } = await supabase.from("gmp_branches").select("id").eq("id", String(branchId)).eq("organization_id", organizationId).eq("active", true).maybeSingle();
  return Boolean(data);
}

export async function GET() {
  try {
    const { supabase, organization } = await requireMerchantPlan(["business"]);
    const { data, error } = await supabase.from("gmp_cameras").select("id,name,camera_type,protocol,endpoint_url,stream_url,stream_kind,status,enabled,last_seen_at,last_error,store_id,branch_id,created_at,updated_at").eq("organization_id", organization.id).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ rows: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, organization } = await requireMerchantPlan(["business"]);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    const name = String(body.name ?? "").trim();
    const cameraType = String(body.camera_type ?? "ip");
    const protocol = String(body.protocol ?? "rtsp");
    const streamKind = body.stream_kind ? String(body.stream_kind) : null;
    const endpointUrl = safeUrl(body.endpoint_url);
    const streamUrl = safeUrl(body.stream_url);
    const storeId = body.store_id ? String(body.store_id) : null;
    const branchId = body.branch_id ? String(body.branch_id) : null;
    if (!name || name.length > 120 || !types.has(cameraType) || !protocols.has(protocol) || (streamKind && !kinds.has(streamKind)) || (body.endpoint_url && !endpointUrl) || (body.stream_url && !streamUrl)) return NextResponse.json({ error: "invalid_camera" }, { status: 400 });
    const store = await validStore(supabase, organization.id, storeId);
    if (storeId && !store) return NextResponse.json({ error: "store_not_found" }, { status: 400 });
    if (!(await validBranch(supabase, organization.id, branchId))) return NextResponse.json({ error: "branch_not_found" }, { status: 400 });
    if (store?.branch_id && branchId && String(store.branch_id) !== branchId) return NextResponse.json({ error: "store_branch_mismatch" }, { status: 400 });
    const { data, error } = await supabase.from("gmp_cameras").insert({ organization_id: organization.id, branch_id: branchId, store_id: storeId, name, camera_type: cameraType, protocol, endpoint_url: endpointUrl, stream_url: streamUrl, stream_kind: streamKind, endpoint_secret_ref: body.endpoint_secret_ref ? String(body.endpoint_secret_ref).slice(0, 500) : null, enabled: body.enabled !== false, status: "unconfigured", created_by: user.id }).select("id,name,camera_type,protocol,endpoint_url,stream_url,stream_kind,status,enabled,store_id,branch_id,created_at").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, row: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, organization } = await requireMerchantPlan(["business"]);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const id = String(body?.id ?? "");
    if (!body || !id) return NextResponse.json({ error: "camera_id_required" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 120);
    if (body.protocol !== undefined) { const p = String(body.protocol); if (!protocols.has(p)) return NextResponse.json({ error: "invalid_protocol" }, { status: 400 }); patch.protocol = p; }
    if (body.camera_type !== undefined) { const p = String(body.camera_type); if (!types.has(p)) return NextResponse.json({ error: "invalid_camera_type" }, { status: 400 }); patch.camera_type = p; }
    if (body.endpoint_url !== undefined) { const u = safeUrl(body.endpoint_url); if (body.endpoint_url && !u) return NextResponse.json({ error: "invalid_endpoint_url" }, { status: 400 }); patch.endpoint_url = u; }
    if (body.stream_url !== undefined) { const u = safeUrl(body.stream_url); if (body.stream_url && !u) return NextResponse.json({ error: "invalid_stream_url" }, { status: 400 }); patch.stream_url = u; }
    if (body.stream_kind !== undefined) { const k = body.stream_kind ? String(body.stream_kind) : null; if (k && !kinds.has(k)) return NextResponse.json({ error: "invalid_stream_kind" }, { status: 400 }); patch.stream_kind = k; }
    if (body.endpoint_secret_ref !== undefined) patch.endpoint_secret_ref = body.endpoint_secret_ref ? String(body.endpoint_secret_ref).slice(0, 500) : null;
    if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
    if (body.status !== undefined) { const s = String(body.status); if (!["unconfigured","online","offline","error","disabled"].includes(s)) return NextResponse.json({ error: "invalid_camera_status" }, { status: 400 }); patch.status = s; }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "no_changes" }, { status: 400 });
    const { data, error } = await supabase.from("gmp_cameras").update(patch).eq("id", id).eq("organization_id", organization.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, row: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, organization } = await requireMerchantPlan(["business"]);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!id) return NextResponse.json({ error: "camera_id_required" }, { status: 400 });
    const { error } = await supabase.from("gmp_cameras").delete().eq("id", id).eq("organization_id", organization.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}
