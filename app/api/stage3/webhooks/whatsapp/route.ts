import{NextResponse}from"next/server";
import{readBoundedRequestText}from"../../../../../lib/bounded-body";
import{verifyWhatsAppWebhook}from"../../../../../lib/stage3/whatsapp";
import{createSupabaseAdminClient}from"../../../../../lib/supabase/admin";

const MAX_WEBHOOK_BYTES=256*1024;
const MAX_EVENTS=100;

export async function POST(request:Request){
  let raw:string;
  try{raw=await readBoundedRequestText(request,MAX_WEBHOOK_BYTES);}
  catch(error){
    if(error instanceof Error&&error.message==="request_body_too_large")return NextResponse.json({error:"request_body_too_large",max_bytes:MAX_WEBHOOK_BYTES},{status:413});
    return NextResponse.json({error:"invalid_request"}, {status:400});
  }
  if(!verifyWhatsAppWebhook(raw,request.headers.get("x-gmp-signature")))return NextResponse.json({error:"invalid_signature"},{status:401});
  let p:Record<string,unknown>;
  try{p=JSON.parse(raw) as Record<string,unknown>}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
  const admin=createSupabaseAdminClient();
  if(!admin)return NextResponse.json({error:"service_not_configured"},{status:503});
  if(Array.isArray(p.events)&&p.events.length>MAX_EVENTS)return NextResponse.json({error:"too_many_events",max_events:MAX_EVENTS},{status:413});
  const events=Array.isArray(p.events)?p.events:[p];
  for(const item of events){
    const e=item as Record<string,unknown>;
    const id=String(e.client_reference||"");
    const status=String(e.status||"sent");
    if(id)await admin.from("gmp_whatsapp_messages").update({
      status:["sent","delivered","read","failed"].includes(status)?status:"failed",
      external_id:String(e.message_id||e.external_id||"")||null,
      delivered_at:status==="delivered"?new Date().toISOString():undefined,
      read_at:status==="read"?new Date().toISOString():undefined,
      last_error:status==="failed"?String(e.error||"provider_failed").slice(0,500):null,
      updated_at:new Date().toISOString()
    }).eq("id",id)
  }
  return NextResponse.json({received:true})
}
