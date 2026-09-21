import { isSameOriginRequest } from "../../../../lib/request-security";
import { readBoundedRequestJson } from "../../../../lib/bounded-body";
import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

const entityTypes = new Set(["gold_purchase", "sale", "customer", "repair", "other"]);
const caseTypes = new Set(["review", "suspicious", "report", "government_submission"]);
const statuses = new Set(["open", "under_review", "submitted", "accepted", "rejected", "closed", "failed"]);
const directions = new Set(["outbound", "inbound", "internal"]);
const transitions: Record<string, Set<string>> = {
  open: new Set(["under_review", "closed", "failed"]),
  under_review: new Set(["submitted", "closed", "failed"]),
  submitted: new Set(["accepted", "rejected", "failed"]),
  failed: new Set(["under_review", "closed"]),
};

export async function GET(request: Request) {
  try {
    const { supabase, organization } = await requireMerchantPlan(["business"]);
    const url = new URL(request.url);
    const entityType = url.searchParams.get("entity_type");
    const entityId = url.searchParams.get("entity_id");
    let casesQuery = supabase.from("gmp_compliance_cases").select("id,branch_id,entity_type,entity_id,case_type,status,government_reference,connector_id,notes,created_by,created_at,updated_at").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(100);
    if (entityType && entityTypes.has(entityType)) casesQuery = casesQuery.eq("entity_type", entityType);
    if (entityId) casesQuery = casesQuery.eq("entity_id", entityId);
    const [{ data: cases, error: casesError }, { data: connectors, error: connectorsError }] = await Promise.all([
      casesQuery,
      supabase.from("gmp_compliance_connectors").select("id,country_code,provider_code,provider_name,integration_mode,base_url,api_version,status,capabilities").order("country_code")
    ]);
    if (casesError || connectorsError) return NextResponse.json({ error: casesError?.message ?? connectorsError?.message ?? "load_failed" }, { status: 400 });
    const caseIds = (cases ?? []).map((row) => row.id);
    let events: any[] = [];
    if (caseIds.length) {
      const result = await supabase.from("gmp_compliance_events").select("id,case_id,direction,event_type,idempotency_key,external_reference,http_status,payload_hash,occurred_at").in("case_id", caseIds).order("occurred_at", { ascending: false }).limit(300);
      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
      events = result.data ?? [];
    }
    const { data: goldPurchases } = await supabase.from("gmp_person_gold_purchases").select("id,transaction_no,seller_name,seller_phone,weight_grams,karat,purchase_price,status,risk_level,created_at").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(30);
    return NextResponse.json({ cases: cases ?? [], events, connectors: connectors ?? [], goldPurchases: goldPurchases ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return new Response(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  try {
    const { supabase, user, organization } = await requireMerchantPlan(["business"]);
    const body = await readBoundedRequestJson(request, 64 * 1024).catch(() => null) as Record<string, any> | null;
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    if (body.action === "event") {
      const caseId = String(body.case_id ?? "");
      const direction = String(body.direction ?? "internal");
      const eventType = String(body.event_type ?? "note").trim();
      if (!caseId || !directions.has(direction) || !eventType) return NextResponse.json({ error: "invalid_event" }, { status: 400 });
      const { data: caseRow } = await supabase.from("gmp_compliance_cases").select("id").eq("id", caseId).eq("organization_id", organization.id).maybeSingle();
      if (!caseRow) return NextResponse.json({ error: "case_not_found" }, { status: 404 });
      const key = String(body.idempotency_key ?? `${caseId}:${eventType}:${Date.now()}`).slice(0, 200);
      const { data, error } = await supabase.from("gmp_compliance_events").insert({ case_id: caseId, direction, event_type: eventType.slice(0, 120), idempotency_key: key, external_reference: body.external_reference ? String(body.external_reference).slice(0, 200) : null, http_status: body.http_status ? Number(body.http_status) : null, payload_hash: body.payload_hash ? String(body.payload_hash).slice(0, 200) : null }).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, row: data }, { status: 201 });
    }
    const entityType = String(body.entity_type ?? "");
    const caseType = String(body.case_type ?? "review");
    const branchId = body.branch_id ? String(body.branch_id) : null;
    if (!entityTypes.has(entityType) || !caseTypes.has(caseType)) return NextResponse.json({ error: "invalid_case" }, { status: 400 });
    if (branchId) {
      const { data: branch } = await supabase.from("gmp_branches").select("id").eq("id", branchId).eq("organization_id", organization.id).eq("active", true).maybeSingle();
      if (!branch) return NextResponse.json({ error: "branch_not_found" }, { status: 400 });
    }
    if (body.entity_id) {
      const { data: existing } = await supabase.from("gmp_compliance_cases").select("id").eq("organization_id", organization.id).eq("entity_type", entityType).eq("entity_id", String(body.entity_id)).in("status", ["open", "under_review", "submitted"]).limit(1);
      if (existing?.length) return NextResponse.json({ error: "active_case_exists", case_id: existing[0].id }, { status: 409 });
    }
    const { data, error } = await supabase.from("gmp_compliance_cases").insert({ organization_id: organization.id, branch_id: branchId, entity_type: entityType, entity_id: body.entity_id ? String(body.entity_id) : null, case_type: caseType, status: "open", connector_id: body.connector_id ? String(body.connector_id) : null, government_reference: body.government_reference ? String(body.government_reference).slice(0, 200) : null, notes: body.notes ? String(body.notes).slice(0, 4000) : null, created_by: user.id }).select("*").single();
    if (error) {
      if (String(error.code) === "23505" && String(error.message).includes("gmp_compliance_active_entity_uniq")) {
        const { data: active } = await supabase.from("gmp_compliance_cases").select("id").eq("organization_id", organization.id).eq("entity_type", entityType).eq("entity_id", String(body.entity_id)).in("status", ["open", "under_review", "submitted"]).limit(1);
        return NextResponse.json({ error: "active_case_exists", case_id: active?.[0]?.id ?? null }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, row: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return new Response(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  try {
    const { supabase, organization } = await requireMerchantPlan(["business"]);
    const body = await readBoundedRequestJson(request, 64 * 1024).catch(() => null) as Record<string, any> | null;
    const id = String(body?.id ?? "");
    if (!body || !id) return NextResponse.json({ error: "case_id_required" }, { status: 400 });
    const patch: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!statuses.has(status)) return NextResponse.json({ error: "invalid_case_status" }, { status: 400 });
      const { data: current, error: currentError } = await supabase.from("gmp_compliance_cases").select("status").eq("id", id).eq("organization_id", organization.id).maybeSingle();
      if (currentError) return NextResponse.json({ error: currentError.message }, { status: 400 });
      if (!current) return NextResponse.json({ error: "case_not_found" }, { status: 404 });
      if (status !== current.status && (!transitions[current.status] || !transitions[current.status].has(status))) return NextResponse.json({ error: "invalid_case_transition", from: current.status, to: status }, { status: 409 });
      patch.status = status;
    }
    if (body.connector_id !== undefined) patch.connector_id = body.connector_id ? String(body.connector_id) : null;
    if (body.government_reference !== undefined) patch.government_reference = body.government_reference ? String(body.government_reference).slice(0, 200) : null;
    if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes).slice(0, 4000) : null;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "no_changes" }, { status: 400 });
    const { data, error } = await supabase.from("gmp_compliance_cases").update(patch).eq("id", id).eq("organization_id", organization.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, row: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}
