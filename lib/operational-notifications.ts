import { createSupabaseAdminClient } from "./supabase/admin";
import { getWhatsAppStatus, sendWhatsAppTemplate } from "./stage3/whatsapp";

type EventKind = "sale"|"invoice"|"repair_ready"|"payment_reminder"|"einvoice"|"order";

const templates: Record<EventKind,string> = {
  sale: "gmp_sale_created",
  invoice: "gmp_invoice_ready",
  repair_ready: "gmp_repair_ready",
  payment_reminder: "gmp_payment_reminder",
  einvoice: "gmp_einvoice_status",
  order: "gmp_marketplace_order",
};

export async function queueCustomerWhatsApp(input:{
  organizationId:string;
  recipient?:string|null;
  kind:EventKind;
  parameters?:Array<string|number>;
  documentUrl?:string|null;
  metadata?:Record<string,unknown>;
}) {
  const recipient=String(input.recipient??"").trim();
  if (!recipient) return { queued:false, reason:"recipient_missing" };
  const admin=createSupabaseAdminClient();
  if (!admin) return { queued:false, reason:"service_not_configured" };
  const status=getWhatsAppStatus();
  const payload={kind:input.kind,parameters:input.parameters??[],document_url:input.documentUrl??null,metadata:input.metadata??{}};
  const eventKey = [input.metadata?.event_id,input.metadata?.submission_id,input.metadata?.sale_id,input.metadata?.order_id,input.metadata?.repair_id].find((value) => value != null && String(value).trim())?.toString().trim();
  const idempotencyKey = eventKey ? `${input.kind}:${eventKey}` : null;
  if (idempotencyKey) {
    const { data: existing } = await admin.from("gmp_whatsapp_messages").select("id,status,external_id").eq("organization_id",input.organizationId).eq("idempotency_key",idempotencyKey).maybeSingle();
    if (existing) return {queued:true,id:existing.id,sent:existing.status==="sent",idempotent:true};
  }
  const {data:row,error}=await admin.from("gmp_whatsapp_messages").insert({
    organization_id:input.organizationId,
    recipient,
    message_type:"template",
    template_name:templates[input.kind],
    payload,
    status:"queued",
    idempotency_key:idempotencyKey,
  }).select("id").single();
  if(error) {
    if(idempotencyKey && String(error.code)==="23505") {
      const { data: existing } = await admin.from("gmp_whatsapp_messages").select("id,status,external_id").eq("organization_id",input.organizationId).eq("idempotency_key",idempotencyKey).maybeSingle();
      if (existing) return {queued:true,id:existing.id,sent:existing.status==="sent",idempotent:true};
    }
    return {queued:false,reason:error.message??"queue_failed"};
  }
  if(!row) return {queued:false,reason:"queue_failed"};
  if(status.state!=="live") return {queued:true,id:row.id,integration_state:"integration_ready"};
  try {
    const result=await sendWhatsAppTemplate({to:recipient,templateName:templates[input.kind],parameters:input.parameters,clientReference:row.id});
    await admin.from("gmp_whatsapp_messages").update({status:"sent",provider:status.provider,external_id:String((result as any)?.message_id??(result as any)?.id??"")||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",row.id);
    return {queued:true,id:row.id,sent:true};
  } catch (error) {
    const message=error instanceof Error?error.message:"provider_failed";
    await admin.from("gmp_whatsapp_messages").update({status:"failed",provider:status.provider,last_error:message.slice(0,500),attempts:1,next_retry_at:new Date(Date.now()+60_000).toISOString(),updated_at:new Date().toISOString()}).eq("id",row.id);
    return {queued:true,id:row.id,sent:false,error:"provider_failed"};
  }
}
