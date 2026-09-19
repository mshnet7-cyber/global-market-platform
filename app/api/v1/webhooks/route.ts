import { NextResponse } from "next/server";
import { authenticateApiKey, apiCorsHeaders } from "../../../../lib/api-keys";
import { encryptWebhookSecret, validateWebhookUrl } from "../../../../lib/webhooks";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { randomUUID } from "crypto";

const EVENT_TYPES = ["market.alert.triggered"] as const;
function failure(error:unknown){const message=error instanceof Error?error.message:"webhook_error";const status=message==="api_key_required"||message==="api_key_invalid"?401:message==="api_scope_denied"?403:message==="api_rate_limited"?429:message==="webhook_encryption_not_configured"?503:400;return NextResponse.json({error:message,request_id:randomUUID()},{status,headers:apiCorsHeaders()});}
export async function OPTIONS(){return new NextResponse(null,{status:204,headers:apiCorsHeaders()});}

export async function GET(request:Request){
  try{
    const key=await authenticateApiKey(request,"webhooks:write");
    const admin=createSupabaseAdminClient();if(!admin)throw new Error("api_unavailable");
    const {data,error}=await admin.from("gmp_webhook_endpoints").select("id,url,event_types,enabled,secret_hint,created_at,updated_at").eq("organization_id",key.organizationId).order("created_at",{ascending:false});
    if(error)throw new Error(error.message);
    return NextResponse.json({endpoints:data??[]},{headers:apiCorsHeaders()});
  }catch(error){return failure(error);}
}
export async function POST(request:Request){
  try{
    const key=await authenticateApiKey(request,"webhooks:write");
    if(!key.organizationId)throw new Error("organization_required");
    const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
    const target=String(body?.url??"").trim();
    const secret=String(body?.signing_secret??"");
    const events=Array.isArray(body?.event_types)?body.event_types.map(String).slice(0,20):["market.alert.triggered"];
    if(!(await validateWebhookUrl(target))||secret.length<16||secret.length>512||!events.length||events.some(event=>!EVENT_TYPES.includes(event as typeof EVENT_TYPES[number])))throw new Error("invalid_webhook");
    const admin=createSupabaseAdminClient();if(!admin)throw new Error("api_unavailable");
    const encrypted=encryptWebhookSecret(secret);
    const record={organization_id:key.organizationId,url:target,event_types:events,secret_ciphertext:encrypted,secret_hint:secret.slice(-4),enabled:true};
    const {data,error}=await admin.from("gmp_webhook_endpoints").insert(record).select("id,url,event_types,enabled,secret_hint,created_at").single();
    if(error)throw new Error(error.message);
    return NextResponse.json({success:true,endpoint:data},{status:201,headers:apiCorsHeaders()});
  }catch(error){return failure(error);}
}
export async function DELETE(request:Request){
  try{
    const key=await authenticateApiKey(request,"webhooks:write");
    const id=new URL(request.url).searchParams.get("id")??"";
    const admin=createSupabaseAdminClient();if(!admin)throw new Error("api_unavailable");
    if(!id)throw new Error("endpoint_id_required");
    const {error}=await admin.from("gmp_webhook_endpoints").update({enabled:false}).eq("id",id).eq("organization_id",key.organizationId);
    if(error)throw new Error(error.message);
    return NextResponse.json({success:true},{headers:apiCorsHeaders()});
  }catch(error){return failure(error);}
}
