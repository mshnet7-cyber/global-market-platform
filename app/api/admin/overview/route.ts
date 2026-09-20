import { readBoundedRequestJson } from "../../../../lib/bounded-body";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getDemoSession } from "../../../../lib/demo-auth";
import { isSameOriginRequest } from "../../../../lib/request-security";

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"cache-control":"no-store"}});

async function guard(){
  const demo = await getDemoSession();
  if (demo) {
    if (demo.role !== "platform_admin") throw new Error("forbidden");
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("not_configured");
    return { supabase: null, admin, user: { id: demo.account.userId, email: demo.account.email }, demo: true as const };
  }
  const supabase=await createSupabaseServerClient();
  if(!supabase)throw new Error("not_configured");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("unauthorized");
  const {data:profile}=await supabase.from("gmp_profiles").select("id,display_name,role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="platform_admin")throw new Error("forbidden");
  const admin=createSupabaseAdminClient();
  if(!admin)throw new Error("not_configured");
  return {supabase,admin,user,demo:false as const};
}

export async function GET(){
  try{
    const {supabase,admin}=await guard();
    const db = admin ?? supabase;
    const results = await Promise.all([
      db.from("gmp_organizations").select("id,name,slug,owner_id,created_at").order("created_at",{ascending:false}).limit(300),
      db.from("gmp_stores").select("id,organization_id,name,slug,country_code,currency,timezone,created_at").order("created_at",{ascending:false}).limit(500),
      db.from("gmp_branches").select("id,organization_id,name,code,city,active,created_at").order("created_at",{ascending:false}).limit(500),
      db.from("gmp_organization_members").select("organization_id,user_id,role,created_at").order("created_at",{ascending:false}).limit(700),
      db.from("gmp_screens").select("id,store_id,name,status,template,last_seen_at,last_snapshot_at").order("created_at",{ascending:false}).limit(700),
      db.from("gmp_ad_campaigns").select("id,organization_id,store_id,advertiser_name,title,status,starts_at,ends_at,impressions,clicks,budget,created_at").order("created_at",{ascending:false}).limit(500),
      db.from("gmp_data_providers").select("code,name,enabled,commercial_use,public_display,customer_display,redistribution,realtime,updated_at").order("name"),
      db.from("gmp_market_alert_rules").select("id,organization_id,name,rule_type,active,last_triggered_at,created_at").order("created_at",{ascending:false}).limit(500),
      db.from("gmp_audit_logs").select("*").order("created_at",{ascending:false}).limit(100),
      db.from("gmp_plans").select("id,code,name,active").order("code"),
      db.from("gmp_subscriptions").select("organization_id,plan_id,status,current_period_end,created_at").order("created_at",{ascending:false}).limit(500)
    ]);
    const firstError = results.find((result) => result.error)?.error;
    if (firstError) return json({error:"data_load_failed",detail:firstError.message},500);
    const [orgs,stores,branches,members,screens,campaigns,providers,alerts,audits,plans,subscriptions] = results;
    return json({orgs:orgs.data||[],stores:stores.data||[],branches:branches.data||[],members:members.data||[],screens:screens.data||[],campaigns:campaigns.data||[],providers:providers.data||[],alerts:alerts.data||[],audits:audits.data||[],plans:plans.data||[],subscriptions:subscriptions.data||[]});
  }catch(e){const m=e instanceof Error?e.message:"unexpected_error";return json({error:m},m==="unauthorized"?401:m==="forbidden"?403:500);}
}

export async function POST(request:Request){
  if (!isSameOriginRequest(request)) return json({error:"cross_site_request"},403);
  try{
    const {supabase,admin,user}=await guard();
    const db = admin ?? supabase;
    const b=await readBoundedRequestJson(request, 64 * 1024).catch(()=>null) as Record<string,unknown>|null;
    if(!b)return json({error:"invalid_json"},400);
    const action=String(b.action||"");
    const id=String(b.id||"");
    if(action==="directory_status"){
      const status=String(b.status||"draft");
      if(!["draft","published","suspended"].includes(status))return json({error:"invalid_status"},400);
      const {data,error}=await db.from("gmp_store_directory").update({status,published_at:status==="published"?new Date().toISOString():null,updated_by:user.id}).eq("store_id",id).select("*").single();
      if(error)return json({error:error.message},400);
      return json({success:true,row:data});
    }
    if(action==="campaign_status"){
      const status=String(b.status||"pending");
      if(!["pending","approved","rejected","paused","completed"].includes(status))return json({error:"invalid_status"},400);
      const {data,error}=await db.from("gmp_ad_campaigns").update({status,updated_at:new Date().toISOString()}).eq("id",id).select("*").single();
      if(error)return json({error:error.message},400);
      return json({success:true,row:data});
    }
    return json({error:"unsupported_action"},400);
  }catch(e){const m=e instanceof Error?e.message:"unexpected_error";return json({error:m},m==="unauthorized"?401:m==="forbidden"?403:500);}
}
