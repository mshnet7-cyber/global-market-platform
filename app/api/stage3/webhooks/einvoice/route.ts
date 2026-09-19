import { NextResponse } from "next/server";
import { queueCustomerWhatsApp } from "../../../../../lib/operational-notifications";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { verifyEInvoiceWebhook } from "../../../../../lib/stage3/einvoice";
import { recordAuditEvent } from "../../../../../lib/provider-observability";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

const TERMINAL = new Set(["accepted", "rejected", "failed"]);

function canAdvance(from: string, to: string) {
  if (from === to) return false;
  if (from === "queued") return false;
  if (from === "sending") return ["submitted", "accepted", "rejected", "failed"].includes(to);
  if (from === "submitted") return TERMINAL.has(to);
  return false;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyEInvoiceWebhook(raw, request.headers.get("x-gmp-signature"))) return json({ error: "invalid_signature" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const id = String(payload.submission_id || payload.id || "").trim();
  const status = String(payload.status || "").trim();
  if (!id || !["submitted", "accepted", "rejected", "failed"].includes(status)) return json({ error: "invalid_event" }, 400);

  const admin = createSupabaseAdminClient();
  if (!admin) return json({ error: "service_not_configured" }, 503);

  const { data: current, error: lookupError } = await admin
    .from("gmp_einvoice_submissions")
    .select("id,organization_id,sale_id,status")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) return json({ error: "submission_lookup_failed" }, 503);
  if (!current) return json({ received: true, ignored: "submission_not_found", submission_id: id });

  if (current.status === status) {
    return json({ received: true, idempotent: true, submission_id: id, status });
  }

  if (!canAdvance(String(current.status), status)) {
    return json({ received: true, ignored: "stale_or_invalid_status", submission_id: id, current_status: current.status, incoming_status: status });
  }

  const { data, error } = await admin
    .from("gmp_einvoice_submissions")
    .update({
      status,
      external_reference: payload.external_reference ? String(payload.external_reference).slice(0, 200) : null,
      error_code: payload.error_code ? String(payload.error_code).slice(0, 80) : null,
      error_message: payload.error_message ? String(payload.error_message).slice(0, 500) : null,
      response_received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", current.status)
    .select("id,organization_id,sale_id,status")
    .maybeSingle();

  if (error) return json({ error: "submission_update_failed" }, 503);
  if (!data) return json({ received: true, idempotent: true, submission_id: id, status: current.status });

  await recordAuditEvent({
    action: "stage3.einvoice.webhook_status",
    organizationId: data.organization_id,
    entityType: "einvoice_submission",
    entityId: data.id,
    metadata: { status, previous_status: current.status },
  });

  const sale = await admin
    .from("gmp_sales")
    .select("customer_id,invoice_no")
    .eq("id", String(data.sale_id || payload.sale_id || ""))
    .eq("organization_id", data.organization_id)
    .maybeSingle();

  if (sale.data?.customer_id && TERMINAL.has(status)) {
    const customer = await admin
      .from("gmp_customers")
      .select("phone")
      .eq("id", sale.data.customer_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();

    if (customer.data?.phone) {
      void queueCustomerWhatsApp({
        organizationId: data.organization_id,
        recipient: customer.data.phone,
        kind: "einvoice",
        parameters: [String(sale.data.invoice_no ?? ""), status],
        metadata: { submission_id: data.id, status },
      });
    }
  }

  return json({ received: true, processed: true, submission_id: data.id, status });
}
