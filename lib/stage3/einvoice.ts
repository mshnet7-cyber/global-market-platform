import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationState } from "./types";
import { readBoundedText } from "./provider-http";

function cfg() {
  return {
    provider: process.env.GMP_EINVOICE_PROVIDER?.trim() || null,
    baseUrl: process.env.GMP_EINVOICE_BASE_URL?.trim().replace(/\/$/, "") || null,
    apiKey: process.env.GMP_EINVOICE_API_KEY?.trim() || null,
    webhookSecret: process.env.GMP_EINVOICE_WEBHOOK_SECRET?.trim() || null,
    approved: process.env.GMP_EINVOICE_APPROVED === "true",
  };
}

export function getEInvoiceStatus() {
  const c = cfg();
  const state: IntegrationState = c.provider && c.baseUrl && c.apiKey && c.approved ? "live" : "integration_ready";
  return { state, provider: c.provider, reason: state === "live" ? undefined : "government_or_provider_credentials_and_approval_not_configured" };
}

export function buildInvoicePayload(input: { countryCode:string; invoiceNumber:string; currency:string; supplier:Record<string,unknown>; customer:Record<string,unknown>; lines:Array<Record<string,unknown>>; totals:Record<string,unknown>; }) {
  return { schema_version:"stage3-1",country_code:input.countryCode,invoice_number:input.invoiceNumber,currency:input.currency,supplier:input.supplier,customer:input.customer,lines:input.lines,totals:input.totals };
}

export function validateInvoicePayload(payload: Record<string,unknown>) {
  const required=["schema_version","country_code","invoice_number","currency","supplier","lines","totals"];
  const missing=required.filter(key=>!(key in payload)); if(missing.length)throw new Error(`invoice_payload_missing_${missing.join("_")}`);
  if(typeof payload.country_code!=="string"||!/^[A-Z]{2}$/.test(payload.country_code))throw new Error("invoice_country_invalid");
  if(typeof payload.invoice_number!=="string"||!payload.invoice_number.trim())throw new Error("invoice_number_invalid");
  if(!Array.isArray(payload.lines)||payload.lines.length>500)throw new Error("invoice_lines_invalid");
  return true;
}

export async function submitInvoice(payload: Record<string,unknown>) {
  const c=cfg(); if(!c.baseUrl||!c.apiKey||!c.approved)throw new Error("einvoice_not_configured");
  let providerUrl: URL;
  try { providerUrl = new URL(c.baseUrl); } catch { throw new Error("einvoice_endpoint_invalid"); }
  if (providerUrl.protocol !== "https:" || providerUrl.username || providerUrl.password) throw new Error("einvoice_endpoint_invalid");
  const requestHash=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10_000);
  let response:Response;
  try {
    response=await fetch(`${providerUrl.toString().replace(/\/$/,"")}/invoices`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${c.apiKey}`,"x-gmp-request-hash":requestHash,"idempotency-key":requestHash},body:JSON.stringify(payload),cache:"no-store",signal:controller.signal,redirect:"error"});
    const raw=await readBoundedText(response);
    let data:Record<string,unknown>={};
    try{data=JSON.parse(raw) as Record<string,unknown>}catch{data={raw:raw.slice(0,4000)}}
    if(!response.ok)throw new Error(`einvoice_provider_http_${response.status}`);
    return {requestHash,data};
  } finally {
    clearTimeout(timer);
  }
}

export function verifyEInvoiceWebhook(body:string,signature:string|null) {
  const secret=cfg().webhookSecret; if(!secret||!signature)return false; const expected=createHmac("sha256",secret).update(body).digest("hex"),provided=signature.replace(/^sha256=/i,""); if(expected.length!==provided.length)return false; return timingSafeEqual(Buffer.from(expected),Buffer.from(provided));
}
