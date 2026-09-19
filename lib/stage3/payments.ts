import { createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationState } from "./types";

export const BILLING_STATUSES = ["created","payment_pending","active","past_due","grace_period","expired","canceled","suspended"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

const transitions: Record<BillingStatus, readonly BillingStatus[]> = {
  created: ["payment_pending","canceled"],
  payment_pending: ["active","past_due","canceled"],
  active: ["past_due","grace_period","canceled","suspended"],
  past_due: ["active","grace_period","expired","canceled","suspended"],
  grace_period: ["active","expired","canceled","suspended"],
  suspended: ["active","canceled"],
  expired: ["active","canceled"],
  canceled: ["active"],
};

export function canTransition(from: BillingStatus, to: BillingStatus) { return from === to || transitions[from]?.includes(to) === true; }
export function assertTransition(from: string, to: string): asserts to is BillingStatus {
  if (!BILLING_STATUSES.includes(from as BillingStatus) || !BILLING_STATUSES.includes(to as BillingStatus) || !canTransition(from as BillingStatus, to as BillingStatus)) throw new Error("invalid_subscription_transition");
}

function cfg() {
  return {
    provider: process.env.GMP_PAYMENT_PROVIDER?.trim() || null,
    checkoutUrl: process.env.GMP_PAYMENT_CHECKOUT_URL?.trim().replace(/\/$/, "") || null,
    apiKey: process.env.GMP_PAYMENT_API_KEY?.trim() || null,
    webhookSecret: process.env.GMP_PAYMENT_WEBHOOK_SECRET?.trim() || null,
    approved: process.env.GMP_PAYMENT_APPROVED === "true",
  };
}

export function getPaymentStatus() {
  const c = cfg();
  const state: IntegrationState = c.checkoutUrl && c.apiKey && c.approved ? "live" : "integration_ready";
  return { state, provider: c.provider, reason: state === "live" ? undefined : "provider_credentials_or_commercial_approval_not_configured" };
}

export async function createHostedCheckout(input: { planCode:string; billingPeriod:string; amount:number; currency:string; successUrl:string; cancelUrl:string; customerReference:string; }) {
  const c = cfg();
  if (!c.checkoutUrl || !c.apiKey || !c.approved) throw new Error("payments_not_configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await fetch(c.checkoutUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${c.apiKey}` },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
      redirect: "error",
    });
  } finally {
    clearTimeout(timer);
  }
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { data = { raw: raw.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`payment_provider_http_${response.status}`);
  return data;
}

export function verifyPaymentWebhook(body: string, signature: string | null) {
  const secret = cfg().webhookSecret;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const provided = signature.replace(/^sha256=/i, "");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
