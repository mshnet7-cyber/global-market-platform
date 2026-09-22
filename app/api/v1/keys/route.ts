import { isSameOriginRequest } from "../../../../lib/request-security";
import { readBoundedRequestJson } from "../../../../lib/bounded-body";
import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";
import { API_SCOPES, createApiKeyMaterial } from "../../../../lib/api-keys";
import { recordAuditEvent } from "../../../../lib/provider-observability";

export async function GET(){
  try{
    const {supabase,organization}=await requireMerchantPlan(["pro","business"]);
    const {data,error}=await supabase.from("gmp_api_keys").select("id,name,key_prefix,scopes,last_used_at,revoked_at,created_at").eq("organization_id",organization.id).order("created_at",{ascending:false});
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({keys:data??[],scopes:API_SCOPES});
  }catch(error){const message=error instanceof Error?error.message:"unexpected_error";return NextResponse.json({error:message},{status:message==="merchant_plan_required"?403:401});}
}

export async function POST(request:Request){
  if (!isSameOriginRequest(request)) return new Response(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  try{
    const {supabase,user,organization}=await requireMerchantPlan(["pro","business"]);
    const body=await readBoundedRequestJson(request, 64 * 1024).catch(()=>null) as Record<string,unknown>|null;
    const name=String(body?.name??"Integration key").trim().slice(0,80);
    const requested=Array.isArray(body?.scopes)?body.scopes.map(String):[...API_SCOPES];
    const scopes=requested.filter((scope):scope is (typeof API_SCOPES)[number]=>API_SCOPES.includes(scope as any));
    if(!scopes.length||scopes.length!==new Set(scopes).size)return NextResponse.json({error:"invalid_scopes"},{status:400});
    const material=createApiKeyMaterial();
    const {data,error}=await supabase.from("gmp_api_keys").insert({organization_id:organization.id,name,key_prefix:material.prefix,key_hash:material.hash,scopes}).select("id,name,key_prefix,scopes,created_at").single();
    if(error)return NextResponse.json({error:error.message},{status:400});
    await recordAuditEvent({action:"api.key.created",organizationId:organization.id,userId:user.id,entityType:"api_key",entityId:data.id,metadata:{scopes}});
    return NextResponse.json({success:true,key:material.key,record:data},{status:201});
  }catch(error){const message=error instanceof Error?error.message:"unexpected_error";return NextResponse.json({error:message},{status:message==="merchant_plan_required"?403:503});}
}

export async function DELETE(request:Request){
  if (!isSameOriginRequest(request)) return new Response(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });

  try{
    const {supabase,organization}=await requireMerchantPlan(["pro","business"]);
    const id=new URL(request.url).searchParams.get("id")??"";
    if(!id)return NextResponse.json({error:"key_id_required"},{status:400});
    const {error}=await supabase.from("gmp_api_keys").update({revoked_at:new Date().toISOString()}).eq("id",id).eq("organization_id",organization.id);
    if(error)return NextResponse.json({error:error.message},{status:400});
    await recordAuditEvent({action:"api.key.revoked",organizationId:organization.id,entityType:"api_key",entityId:id});
    return NextResponse.json({success:true});
  }catch(error){const message=error instanceof Error?error.message:"unexpected_error";return NextResponse.json({error:message},{status:message==="merchant_plan_required"?403:503});}
}
