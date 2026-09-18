import { NextResponse } from "next/server";
import { verifyWhatsAppWebhook } from "../../../../../lib/stage3/whatsapp";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";

export async function POST(request:Request){
  const raw=await request.text();
  if(!verifyWhatsAppWebhook(raw,request.headers.get("x-gmp-signature"))) return NextResponse.json({error:"invalid_signature"},{status:401});
  const payload=JSON.parse(raw) as Record<string,unknown>;
  const admin=createSupabaseAdminClient(); if(!admin) return NextResponse.json({error:"service_not_configured"},{status:503});
  const events=Array.isArray(payload.events)?payload.events:[payload];
  for(const event of events){
    const e=event as Record<string,unknown>;
    const messageId=String(e.client_reference||e.message_id||"");
    const status=String(e.status||"sent");
    if(messageId){
      await admin.from("gmp_whatsapp_messages").update({
        status:["sent","delivered","read","failed"].includes(status)?status:"failed",
        external_id:String(e.message_id||e.external_id||""),
        delivered_at:status==="delivered"?new Date().toISOString():undefined,
        read_at:status==="read"?new Date().toISOString():undefined,
        last_error:status==="failed"?String(e.error||"provider_failed").slice(0,500):null,
        updated_at:new Date().toISOString()
      }).eq("id",messageId);
    }
  }
  return NextResponse.json({received:true},{status:200});
}
