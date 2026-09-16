import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

const countries = new Set(["OM", "SA", "AE"]);
const statuses = new Set(["queued", "sending", "submitted", "accepted", "rejected", "failed", "cancelled"]);

export async function GET() {
  try {
    const { supabase, organization } = await requireMerchantPlan(["business"]);
    const [{ data: profiles, error: profileError }, { data: connectors, error: connectorError }, { data: submissions, error: submissionError }] = await Promise.all([
      supabase.from("gmp_country_invoice_profiles").select("id,store_id,country_code,legal_name,tax_number,registration_number,currency,vat_rate,e_invoice_enabled,connector_id,settings,created_at,updated_at").eq("organization_id", organization.id).order("country_code"),
      supabase.from("gmp_compliance_connectors").select("id,country_code,provider_code,provider_name,integration_mode,base_url,api_version,status,capabilities").order("country_code"),
      supabase.from("gmp_einvoice_submissions").select("id,store_id,sale_id,connector_id,country_code,status,idempotency_key,external_reference,error_code,error_message,submitted_at,response_received_at,created_at,updated_at").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(50)
    ]);
    if (profileError || connectorError || submissionError) return NextResponse.json({ error: profileError?.message ?? connectorError?.message ?? submissionError?.message }, { status: 400 });
    const { data: stores } = await supabase.from("gmp_stores").select("id,name,country_code,currency,tax_number:phone").eq("organization_id", organization.id).order("name");
    return NextResponse.json({ profiles: profiles ?? [], connectors: connectors ?? [], submissions: submissions ?? [], stores: stores ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user, organization } = await requireMerchantPlan(["business"]);
    const body = await request.json().catch(() => null) as Record<string, any> | null;
    if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    if (body.action === "profile") {
      const countryCode = String(body.country_code ?? "").toUpperCase();
      const storeId = body.store_id ? String(body.store_id) : null;
      if (!countries.has(countryCode)) return NextResponse.json({ error: "unsupported_country" }, { status: 400 });
      if (storeId) {
        const { data: store } = await supabase.from("gmp_stores").select("id,country_code,currency").eq("id", storeId).eq("organization_id", organization.id).maybeSingle();
        if (!store) return NextResponse.json({ error: "store_not_found" }, { status: 400 });
        if (String(store.country_code).toUpperCase() !== countryCode) return NextResponse.json({ error: "store_country_mismatch" }, { status: 400 });
      }
      const connectorId = body.connector_id ? String(body.connector_id) : null;
      if (connectorId) {
        const { data: connector } = await supabase.from("gmp_compliance_connectors").select("id,country_code").eq("id", connectorId).maybeSingle();
        if (!connector || String(connector.country_code).toUpperCase() !== countryCode) return NextResponse.json({ error: "connector_country_mismatch" }, { status: 400 });
      }
      const payload = { organization_id: organization.id, store_id: storeId, country_code: countryCode, legal_name: body.legal_name ? String(body.legal_name).slice(0, 250) : null, tax_number: body.tax_number ? String(body.tax_number).slice(0, 100) : null, registration_number: body.registration_number ? String(body.registration_number).slice(0, 100) : null, currency: body.currency ? String(body.currency).slice(0, 3).toUpperCase() : null, vat_rate: Number(body.vat_rate ?? 0), e_invoice_enabled: Boolean(body.e_invoice_enabled), connector_id: connectorId, settings: body.settings && typeof body.settings === "object" ? body.settings : {}, created_by: user.id };
      if (!Number.isFinite(payload.vat_rate) || payload.vat_rate < 0 || payload.vat_rate > 100) return NextResponse.json({ error: "invalid_vat_rate" }, { status: 400 });
      const { data, error } = await supabase.from("gmp_country_invoice_profiles").upsert(payload, { onConflict: "organization_id,store_id,country_code" }).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, row: data }, { status: 201 });
    }
    if (body.action === "queue") {
      const saleId = String(body.sale_id ?? "");
      const countryCode = String(body.country_code ?? "").toUpperCase();
      const storeId = body.store_id ? String(body.store_id) : null;
      if (!saleId || !countries.has(countryCode)) return NextResponse.json({ error: "sale_country_required" }, { status: 400 });
      const { data: sale } = await supabase.from("gmp_sales").select("id,store_id,invoice_no,status").eq("id", saleId).eq("organization_id", organization.id).maybeSingle();
      if (!sale) return NextResponse.json({ error: "sale_not_found" }, { status: 404 });
      if (storeId && String(sale.store_id) !== storeId) return NextResponse.json({ error: "sale_store_mismatch" }, { status: 400 });
      const { data: profile } = await supabase.from("gmp_country_invoice_profiles").select("connector_id,e_invoice_enabled").eq("organization_id", organization.id).eq("country_code", countryCode).eq("store_id", storeId).maybeSingle();
      if (!profile?.e_invoice_enabled || !profile.connector_id) return NextResponse.json({ error: "einvoice_profile_not_ready" }, { status: 409 });
      const { data: connector } = await supabase.from("gmp_compliance_connectors").select("id,status").eq("id", profile.connector_id).maybeSingle();
      if (!connector || connector.status !== "active") return NextResponse.json({ error: "connector_not_active", status: connector?.status ?? null }, { status: 409 });
      const key = String(body.idempotency_key ?? `${saleId}:${countryCode}`).slice(0, 200);
      const { data, error } = await supabase.from("gmp_einvoice_submissions").upsert({ organization_id: organization.id, store_id: sale.store_id, sale_id: sale.id, connector_id: profile.connector_id, country_code: countryCode, status: "queued", idempotency_key: key, created_by: user.id }, { onConflict: "organization_id,idempotency_key" }).select("*").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, queued: true, row: data }, { status: 201 });
    }
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, organization } = await requireMerchantPlan(["business"]);
    const body = await request.json().catch(() => null) as Record<string, any> | null;
    const id = String(body?.id ?? "");
    const status = String(body?.status ?? "");
    if (!body || !id || !statuses.has(status)) return NextResponse.json({ error: "invalid_submission_update" }, { status: 400 });
    const { data, error } = await supabase.from("gmp_einvoice_submissions").update({ status, external_reference: body.external_reference ? String(body.external_reference).slice(0, 200) : undefined, error_code: body.error_code ? String(body.error_code).slice(0, 100) : null, error_message: body.error_message ? String(body.error_message).slice(0, 1000) : null }).eq("id", id).eq("organization_id", organization.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true, row: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return NextResponse.json({ error: message }, { status: message === "merchant_plan_required" ? 403 : 500 });
  }
}
