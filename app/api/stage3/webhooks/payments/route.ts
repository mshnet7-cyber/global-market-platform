import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { queueCustomerWhatsApp } from "../../../../../lib/operational-notifications";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { assertTransition, verifyPaymentWebhook } from "../../../../../lib/stage3/payments";
import { recordAuditEvent } from "../../../../../lib/provider-observability";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

function deriveNextStatus(eventType: string) {
  if (eventType.includes("succeeded") || eventType.includes("renew") || eventType === "subscription.activated" || eventType === "subscription.reactivated") return "active";
  if (eventType.includes("failed") || eventType === "subscription.past_due") return "past_due";
  if (eventType.includes("cancel")) return "canceled";
  if (eventType.includes("suspend")) return "suspended";
  if (eventType.includes("grace")) return "grace_period";
  if (eventType.includes("expire")) return "expired";
  return null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyPaymentWebhook(raw, request.headers.get("x-gmp-signature"))) return json({ error: "invalid_signature" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventKey = String(payload.event_id || payload.id || payload.reference || "").trim();
  const eventType = String(payload.event_type || payload.type || "").trim();
  const provider = String(payload.provider || process.env.GMP_PAYMENT_PROVIDER || "generic").trim().slice(0, 80);
  const subscriptionRef = String(payload.subscription_id || payload.external_subscription_id || "").trim();
  const nextStatus = deriveNextStatus(eventType);

  if (!eventKey || !eventType || !subscriptionRef) return json({ error: "invalid_event" }, 400);
  if (!nextStatus) return json({ received: true, ignored: "unsupported_event" });

  const admin = createSupabaseAdminClient();
  if (!admin) return json({ error: "service_not_configured" }, 503);

  const { data: subscription, error: subscriptionError } = await admin
    .from("gmp_subscriptions")
    .select("id,organization_id,status,provider")
    .eq("external_id", subscriptionRef)
    .eq("provider", provider)
    .maybeSingle();

  if (subscriptionError) return json({ error: "subscription_lookup_failed" }, 503);
  if (!subscription) return json({ received: true, ignored: "subscription_not_found" });

  const payloadHash = createHash("sha256").update(raw).digest("hex");
  const { data: claimRows, error: claimError } = await admin.rpc("gmp_claim_billing_event", {
    p_organization_id: subscription.organization_id,
    p_subscription_id: subscription.id,
    p_event_key: eventKey,
    p_event_type: eventType,
    p_provider: provider,
    p_payload_hash: payloadHash,
  });

  if (claimError) return json({ error: "billing_event_claim_failed" }, 503);
  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!claim?.claimed) {
    return json({
      received: true,
      idempotent: true,
      event_id: claim?.event_id ?? null,
      status: claim?.current_status ?? null,
    });
  }

  const eventId = String(claim.event_id);

  try {
    try {
      assertTransition(subscription.status, nextStatus);
    } catch {
      await admin.from("gmp_billing_events").update({
        status: "failed",
        error_message: "invalid_subscription_transition",
      }).eq("id", eventId);
      return json({ error: "invalid_subscription_transition", current_status: subscription.status, next_status: nextStatus }, 409);
    }

    const paymentRef = String(payload.payment_id || payload.transaction_id || "").trim();
    let paymentId: string | null = null;

    if (paymentRef) {
      const { data: existingPayment, error: paymentLookupError } = await admin
        .from("gmp_payments")
        .select("id")
        .eq("organization_id", subscription.organization_id)
        .eq("external_id", paymentRef)
        .maybeSingle();

      if (paymentLookupError) throw new Error("payment_lookup_failed");

      const paymentStatus = nextStatus === "active" ? "succeeded" : nextStatus === "past_due" ? "failed" : nextStatus;
      const paymentPatch = {
        organization_id: subscription.organization_id,
        subscription_id: subscription.id,
        provider,
        external_id: paymentRef,
        status: paymentStatus,
        amount: typeof payload.amount === "number" ? payload.amount : Number(payload.amount ?? 0),
        currency: String(payload.currency || "OMR"),
      };

      if (existingPayment) {
        const { error } = await admin.from("gmp_payments").update(paymentPatch).eq("id", existingPayment.id);
        if (error) throw new Error("payment_update_failed");
        paymentId = existingPayment.id;
      } else {
        const { data: newPayment, error } = await admin.from("gmp_payments").insert(paymentPatch).select("id").single();
        if (error) throw new Error("payment_insert_failed");
        paymentId = newPayment?.id ?? null;
      }
    }

    const subscriptionPatch: Record<string, unknown> = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    };
    if (payload.current_period_start) subscriptionPatch.current_period_start = payload.current_period_start;
    if (payload.current_period_end || payload.period_end) subscriptionPatch.current_period_end = payload.current_period_end || payload.period_end;
    if (typeof payload.cancel_at_period_end === "boolean") subscriptionPatch.cancel_at_period_end = payload.cancel_at_period_end;
    if (payload.grace_until) subscriptionPatch.grace_until = payload.grace_until;

    const { error: subscriptionUpdateError } = await admin
      .from("gmp_subscriptions")
      .update(subscriptionPatch)
      .eq("id", subscription.id)
      .eq("organization_id", subscription.organization_id);
    if (subscriptionUpdateError) throw new Error("subscription_update_failed");

    const { error: eventUpdateError } = await admin
      .from("gmp_billing_events")
      .update({
        payment_id: paymentId,
        status: "processed",
        error_message: null,
      })
      .eq("id", eventId);

    if (eventUpdateError) return json({ error: "billing_event_finalize_failed", event_id: eventId }, 503);

    await recordAuditEvent({
      action: "stage3.billing." + eventType,
      organizationId: subscription.organization_id,
      entityType: "subscription",
      entityId: subscription.id,
      metadata: { event_id: eventKey, payment_id: paymentId },
    });

    if (nextStatus === "past_due" && payload.customer_phone) {
      void queueCustomerWhatsApp({
        organizationId: subscription.organization_id,
        recipient: String(payload.customer_phone),
        kind: "payment_reminder",
        parameters: [String(payload.amount ?? ""), String(payload.currency ?? "OMR")],
        metadata: { subscription_id: subscription.id, event_id: eventKey },
      });
    }

    return json({ received: true, processed: true, event_id: eventId });
  } catch (error) {
    await admin.from("gmp_billing_events").update({
      status: "failed",
      error_message: error instanceof Error ? error.message.slice(0, 500) : "billing_processing_failed",
    }).eq("id", eventId);
    return json({ error: "billing_processing_failed", event_id: eventId }, 503);
  }
}
