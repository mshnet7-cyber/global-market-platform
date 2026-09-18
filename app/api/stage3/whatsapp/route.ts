import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getWhatsAppStatus, sendWhatsAppTemplate } from "../../../../lib/stage3/whatsapp";
import { recordAuditEvent } from "../../../../lib/provider-observability";

export async function GET() {
  try { await requireMerchantPlan(["business"]); return NextResponse.json(getWhatsAppStatus(), {headers:{"cache-control":"no-store"}}); }
  catch (e) { return NextResponse.json({error:e instanceof Error?e.message:"unauthorized"},{status:401}); }
}

export async function POST(request:Request) {
  try {
    const { organization, user } = await requireMerchantPlan(["business"]);
    const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
    if(!body) return NextResponse.json({error:"invalid_json"},{status:400});
    if(getWhatsAppStatus().state!=="live") return NextResponse.json({error:"whatsapp_not_configured",integration_state:"integration_ready"},{status:503});
    const to=String(body.to||"").trim(), templateName=String(body.template_name||"").trim();
    if(!to||!templateName) return NextResponse.json({error:"recipient_and_template_required"},{status:400});
    const parameters=Array.isArray(body.parameters)?body.parameters.slice(0,20).map(v=>typeof v==="string"||typeof v==="number"?v:String(v)):[]; 
    const admin=createSupabaseAdminClient(); if(!admin)return NextResponse.json({error:"service_not_configured"},{status:503});
    const row={organization_id:organization.id,recipient:to.slice(0,40),message_type:"template",template_name:templateName.slice(0,100),payload:{parameters},status:"queued",provider:getWhatsAppStatus().provider,attempts:0,created_by:user.id};
    const {data,messageError}=await admin.from("gmp_whatsapp_messages").insert(row).select("id").single();
    if(messageError) return NextResponse.json({error:messageError.message},{status:400});
    try {
      const result=await sendWhatsAppTemplate({to,templateName,languageCode:String(body.language_code||"ar"),parameters,clientReference:String(data.id)});
      const externalId=String(result.message_id??result.id??"");
      await admin.from("gmp_whatsapp_messages").update({status:"sent",external_id:externalId,attempts:1,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",data.id);
      await recordAuditEvent({action:"stage3.whatsapp.sent",organizationId:organization.id,userId:user.id,entityType:"whatsapp_message",entityId:data.id,metadata:{template:templateName}});
      return NextResponse.json({success:true,message_id:data.id,provider_id:externalId||null},{status:201});
    } catch {
      await admin.from("gmp_whatsapp_messages").update({status:"failed",attempts:1,last_error:"provider_delivery_failed",updated_at:new Date().toISOString()}).eq("id",data.id);
      return NextResponse.json({error:"whatsapp_provider_failed",message_id:data.id,retryable:true},{status:502});
    }
  } catch(e){const m=e instanceof Error?e.message:"unexpected_error";return NextResponse.json({error:m},{status:m==="merchant_plan_required"?403:500});}
}
