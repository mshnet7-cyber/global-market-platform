import{NextResponse}from"next/server";
import{readBoundedRequestText}from"../../../../../lib/bounded-body";
import{verifyWhatsAppWebhook}from"../../../../../lib/stage3/whatsapp";
import{createSupabaseAdminClient}from"../../../../../lib/supabase/admin";

const MAX_WEBHOOK_BYTES=256*1024;
const MAX_EVENTS=100;
const STATUSES=["sent","delivered","read","failed"] as const;
type WhatsAppWebhookStatus=(typeof STATUSES)[number];

function canAdvance(from:string,to:WhatsAppWebhookStatus){
  if(from===to)return false;
  if(from==="queued")return true;
  if(from==="sent")return to==="delivered"||to==="read"||to==="failed";
  if(from==="delivered")return to==="read";
  return false;
}

export async function POST(request:Request){
  let raw:string;
  try{raw=await readBoundedRequestText(request,MAX_WEBHOOK_BYTES);}
  catch(error){
    if(error instanceof Error&&error.message==="request_body_too_large")return NextResponse.json({error:"request_body_too_large",max_bytes:MAX_WEBHOOK_BYTES},{status:413});
    return NextResponse.json({error:"invalid_request"},{status:400});
  }
  if(!verifyWhatsAppWebhook(raw,request.headers.get("x-gmp-signature")))return NextResponse.json({error:"invalid_signature"},{status:401});
  let p:Record<string,unknown>;
  try{p=JSON.parse(raw) as Record<string,unknown>}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
  const admin=createSupabaseAdminClient();
  if(!admin)return NextResponse.json({error:"service_not_configured"},{status:503});
  if(Array.isArray(p.events)&&p.events.length>MAX_EVENTS)return NextResponse.json({error:"too_many_events",max_events:MAX_EVENTS},{status:413});
  const events=Array.isArray(p.events)?p.events:[p];
  if(events.some(item=>!item||typeof item!=="object"||Array.isArray(item)))return NextResponse.json({error:"invalid_event"},{status:400});

  for(const item of events){
    const e=item as Record<string,unknown>;
    const id=String(e.client_reference||"").trim();
    if(!id)continue;
    const incoming=String(e.status||"sent").trim() as WhatsAppWebhookStatus;
    if(!STATUSES.includes(incoming))return NextResponse.json({error:"invalid_event_status"},{status:400});

    const {data:current,error:lookupError}=await admin
      .from("gmp_whatsapp_messages")
      .select("id,status")
      .eq("id",id)
      .maybeSingle();
    if(lookupError)return NextResponse.json({error:"message_lookup_failed"},{status:503});
    if(!current)continue;
    if(current.status===incoming)continue;
    if(!canAdvance(String(current.status),incoming))continue;

    const patch:Record<string,unknown>={
      status:incoming,
      external_id:String(e.message_id||e.external_id||"").trim()||undefined,
      last_error:incoming==="failed"?String(e.error||"provider_failed").slice(0,500):null,
      updated_at:new Date().toISOString()
    };
    if(incoming==="delivered")patch.delivered_at=new Date().toISOString();
    if(incoming==="read"){
      patch.read_at=new Date().toISOString();
      patch.delivered_at=current.status==="delivered"?undefined:new Date().toISOString();
    }

    await admin.from("gmp_whatsapp_messages")
      .update(patch)
      .eq("id",id)
      .eq("status",current.status);
  }
  return NextResponse.json({received:true});
}
