import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID } from "crypto";
import { createSupabaseAdminClient } from "./supabase/admin";

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
        endpoint_id:endpoint.id,event_id:eventId,event_type:eventType,payload,attempts:0,next_attempt_at:new Date().toISOString(),max_attempts:8
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
    const secret=decryptWebhookSecret(String(delivery.secret_ciphertext));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),2500);
    let response:Response;
    try {
      response=await fetch(String(delivery.url),{
        method:"POST",signal:controller.signal,
        headers:{
          "content-type":"application/json","x-gmp-event":String(delivery.event_type),
          "x-gmp-event-id":String(delivery.event_id),"x-gmp-timestamp":ts,
          "x-gmp-signature":webhookSignature(secret,ts,payloadBody),
        },
        body:payloadBody,cache:"no-store",
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
    const nextAttempt=attempt>=max?null:new Date(Date.now()+Math.min(24*60*60_000,Math.pow(2,Math.max(0,attempt-1))*30_000+Math.floor(Math.random()*5000))).toISOString();
    await admin.from("gmp_webhook_deliveries").update({ok:false,attempts:attempt,last_attempt_at:new Date().toISOString(),next_attempt_at:nextAttempt,dead_lettered:attempt>=max,error_message:error instanceof Error?error.message.slice(0,500):"delivery_failed"}).eq("id",delivery.id);
    return false;
  }
}
