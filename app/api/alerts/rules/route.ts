import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { recordAuditEvent } from "../../../../lib/provider-observability";

const ruleTypes=new Set(["price_above","price_below","change_pct_above","change_pct_below","source_unavailable"]);

async function context(){
  const supabase=await createSupabaseServerClient();
  if(!supabase) throw new Error("api_unavailable");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) throw new Error("auth_required");
  return {supabase,user};
}

export async function GET(){
  try{
    const {supabase,user}=await context();
    const {data,error}=await supabase.from("gmp_market_alert_rules").select("id,instrument_code,provider_code,rule_type,threshold,cooldown_minutes,channels,active,last_triggered_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({rules:data??[]});
  }catch(error){
    const message=error instanceof Error?error.message:"unexpected_error";
    return NextResponse.json({error:message},{status:message==="auth_required"?401:503});
  }
}

export async function POST(request:Request){
  try{
    const {supabase,user}=await context();
    const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
    const instrument=String(body?.instrument_code??"").toUpperCase();
    const ruleType=String(body?.rule_type??"");
    const threshold=body?.threshold===null||body?.threshold===undefined?null:Number(body.threshold);
    const cooldown=Math.min(1440,Math.max(1,Number(body?.cooldown_minutes??30)));
    if(!/^[A-Z0-9_.:/-]{2,40}$/.test(instrument)||!ruleTypes.has(ruleType)||((ruleType!=="source_unavailable")&&(!Number.isFinite(threshold)||threshold!<0))) return NextResponse.json({error:"invalid_rule"},{status:400});
    const {data:existing}=await supabase.from("gmp_market_alert_rules").select("id").eq("user_id",user.id).eq("instrument_code",instrument).eq("rule_type",ruleType).eq("active",true).limit(1);
    if(existing?.length) return NextResponse.json({error:"active_rule_exists",id:existing[0].id},{status:409});
    const result=await supabase.from("gmp_market_alert_rules").insert({user_id:user.id,organization_id:null,instrument_code:instrument,provider_code:body?.provider_code?String(body.provider_code).slice(0,80):null,rule_type:ruleType,threshold,cooldown_minutes:cooldown,channels:Array.isArray(body?.channels)?body.channels.slice(0,5):["in_app"],active:true}).select("id,instrument_code,rule_type,threshold,cooldown_minutes,channels,active").single();
    if(result.error) return NextResponse.json({error:result.error.message},{status:400});
    await recordAuditEvent({action:"alert.rule.created",userId:user.id,entityType:"market_alert_rule",entityId:result.data.id,metadata:{instrument,rule_type:ruleType}});
    return NextResponse.json({success:true,rule:result.data},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:"unexpected_error";
    return NextResponse.json({error:message},{status:message==="auth_required"?401:503});
  }
}

export async function PATCH(request:Request){
  try{
    const {supabase,user}=await context();
    const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
    const id=String(body?.id??"");
    if(!id) return NextResponse.json({error:"rule_id_required"},{status:400});
    const active=body?.active===undefined?undefined:Boolean(body.active);
    const patch:Record<string,unknown>={};
    if(active!==undefined) patch.active=active;
    if(body?.threshold!==undefined){const n=Number(body.threshold);if(!Number.isFinite(n)||n<0)return NextResponse.json({error:"invalid_threshold"},{status:400});patch.threshold=n;}
    if(!Object.keys(patch).length) return NextResponse.json({error:"no_changes"},{status:400});
    const {data,error}=await supabase.from("gmp_market_alert_rules").update(patch).eq("id",id).eq("user_id",user.id).select("id,instrument_code,rule_type,threshold,cooldown_minutes,channels,active").single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    await recordAuditEvent({action:"alert.rule.updated",userId:user.id,entityType:"market_alert_rule",entityId:id,metadata:{fields:Object.keys(patch)}});
    return NextResponse.json({success:true,rule:data});
  }catch(error){const message=error instanceof Error?error.message:"unexpected_error";return NextResponse.json({error:message},{status:message==="auth_required"?401:503});}
}

export async function DELETE(request:Request){
  try{
    const {supabase,user}=await context();
    const id=new URL(request.url).searchParams.get("id")??"";
    if(!id) return NextResponse.json({error:"rule_id_required"},{status:400});
    const {error}=await supabase.from("gmp_market_alert_rules").update({active:false}).eq("id",id).eq("user_id",user.id);
    if(error) return NextResponse.json({error:error.message},{status:400});
    await recordAuditEvent({action:"alert.rule.revoked",userId:user.id,entityType:"market_alert_rule",entityId:id});
    return NextResponse.json({success:true});
  }catch(error){const message=error instanceof Error?error.message:"unexpected_error";return NextResponse.json({error:message},{status:message==="auth_required"?401:503});}
}
