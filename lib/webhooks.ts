import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { createSupabaseAdminClient } from "./supabase/admin";

function isPrivateIPv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 && (c === 0 || c === 2) || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) || a >= 224;
}

function ipv6Words(address: string) {
  const value = address.toLowerCase().split("%")[0];
  if (!value.includes(":")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const expand = (parts: string[]) => {
    const out: number[] = [];
    for (const part of parts) {
      if (part.includes(".")) {
        const octets = part.split(".").map(Number);
        if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
        out.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
        out.push(parseInt(part, 16));
      }
    }
    return out;
  };
  const l = expand(left), r = expand(right);
  if (!l || !r) return null;
  const missing = 8 - l.length - r.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 1) return null;
  return halves.length === 2 ? [...l, ...Array(missing).fill(0), ...r] : [...l, ...r];
}

function isPrivateIp(address: string) {
  if (isIP(address) === 4) return isPrivateIPv4(address);
  if (isIP(address) !== 6) return true;
  const words = ipv6Words(address);
  if (!words) return true;
  if (words.every((word) => word === 0) || (words.slice(0, 7).every((word) => word === 0) && words[7] === 1)) return true;
  const first = words[0];
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00) return true;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return true;
  const mapped = words.slice(0, 6).every((word, index) => word === (index === 5 ? 0xffff : 0));
  if (mapped) return isPrivateIPv4(String((words[6] >> 8) & 255)+"."+String(words[6] & 255)+"."+String((words[7] >> 8) & 255)+"."+String(words[7] & 255));
  return false;
}

export async function validateWebhookUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host === "metadata.google.internal") return false;
  if (isIP(host)) return !isPrivateIp(host);
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((entry) => !isPrivateIp(entry.address));
  } catch {
    return false;
  }
}

function encryptionKey() {
  const value = process.env.GMP_WEBHOOK_ENCRYPTION_KEY;
  if (!value) throw new Error("webhook_encryption_not_configured");
  return createHash("sha256").update(value).digest();
}

export function encryptWebhookSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1." + iv.toString("base64url") + "." + tag.toString("base64url") + "." + encrypted.toString("base64url");
}

function decryptWebhookSecret(value: string) {
  const [version, ivPart, tagPart, dataPart] = value.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) throw new Error("invalid_webhook_secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export function webhookSignature(secret: string, timestamp: string, body: string) {
  return createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
}

export async function dispatchWebhookEvent(organizationId: string | null, eventType: string, payload: Record<string, unknown>) {
  if (!organizationId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  try {
    const { data: endpoints } = await admin.from("gmp_webhook_endpoints")
      .select("id,url,event_types,secret_ciphertext")
      .eq("organization_id", organizationId).eq("enabled", true);
    if (!endpoints?.length) return;
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    for (const endpoint of endpoints.filter((item: any) => {
      const types = Array.isArray(item.event_types) ? item.event_types.map(String) : [];
      return types.length === 0 || types.includes(eventType);
    })) {
      const eventId = randomUUID();
      await admin.from("gmp_webhook_events").insert({event_id:eventId,organization_id:organizationId,event_type:eventType,payload});
      const { data: delivery } = await admin.from("gmp_webhook_deliveries").insert({
        endpoint_id:endpoint.id,event_id:eventId,event_type:eventType,payload,attempts:0,next_attempt_at:new Date(Date.now()+5*60_000).toISOString(),max_attempts:8
      }).select("id").single();
      if (!delivery) continue;
      await deliverWebhookAttempt(admin, { id: delivery.id, endpoint_id:endpoint.id,event_id:eventId,event_type:eventType,url:endpoint.url,secret_ciphertext:endpoint.secret_ciphertext,payload,attempts:0 }, body, timestamp);
    }
  } catch {
    // Webhook delivery must never break the business path.
  }
}

export async function deliverWebhookAttempt(admin:any, delivery:any, body?:string, timestamp?:string) {
  const payloadBody = body ?? JSON.stringify(delivery.payload ?? {});
  const ts = timestamp ?? String(Math.floor(Date.now()/1000));
  try {
    const webhookUrl = String(delivery.url);
    if (!(await validateWebhookUrl(webhookUrl))) throw new Error("webhook_destination_not_allowed");
    const secret=decryptWebhookSecret(String(delivery.secret_ciphertext));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),2500);
    let response:Response;
    try {
      response=await fetch(webhookUrl,{
        method:"POST",signal:controller.signal,
        headers:{
          "content-type":"application/json","x-gmp-event":String(delivery.event_type),
          "x-gmp-event-id":String(delivery.event_id),"x-gmp-timestamp":ts,
          "x-gmp-signature":webhookSignature(secret,ts,payloadBody),
        },
        body:payloadBody,cache:"no-store",redirect:"error",
      });
    } finally { clearTimeout(timer); }
    const attempt=Number(delivery.attempts??0)+1;
    if(response.ok){
      await admin.from("gmp_webhook_deliveries").update({ok:true,status_code:response.status,attempts:attempt,delivered_at:new Date().toISOString(),last_attempt_at:new Date().toISOString(),next_attempt_at:null,error_message:null,dead_lettered:false}).eq("id",delivery.id);
      return true;
    }
    const nextAttempt=attempt>=Number(delivery.max_attempts??8)?null:new Date(Date.now()+Math.min(24*60*60_000,Math.pow(2,Math.max(0,attempt-1))*30_000+Math.floor(Math.random()*5000))).toISOString();
    await admin.from("gmp_webhook_deliveries").update({ok:false,status_code:response.status,attempts:attempt,last_attempt_at:new Date().toISOString(),next_attempt_at:nextAttempt,dead_lettered:attempt>=Number(delivery.max_attempts??8),error_message:(`http_${response.status}`).slice(0,500)}).eq("id",delivery.id);
    return false;
  } catch(error) {
    const attempt=Number(delivery.attempts??0)+1;
    const max=Number(delivery.max_attempts??8);
    const blocked = error instanceof Error && error.message === "webhook_destination_not_allowed";
    const nextAttempt=blocked || attempt>=max ? null : new Date(Date.now()+Math.min(24*60*60_000,Math.pow(2,Math.max(0,attempt-1))*30_000+Math.floor(Math.random()*5000))).toISOString();
    await admin.from("gmp_webhook_deliveries").update({ok:false,attempts:attempt,last_attempt_at:new Date().toISOString(),next_attempt_at:nextAttempt,dead_lettered:blocked || attempt>=max,error_message:error instanceof Error?error.message.slice(0,500):"delivery_failed"}).eq("id",delivery.id);
    return false;
  }
}
