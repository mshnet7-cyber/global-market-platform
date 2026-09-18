import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"cache-control":"no-store"}});

export async function GET(){
  const supabase=await createSupabaseServerClient();
  if(!supabase)return json({error:"service_not_configured"},500);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return json({error:"unauthorized"},401);
  const {data,error}=await supabase.from("gmp_notifications").select("id,type,title,body,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
  if(error)return json({error:error.message},400);
  return json({notifications:data??[]});
}

export async function PATCH(request:Request){
  const supabase=await createSupabaseServerClient();
  if(!supabase)return json({error:"service_not_configured"},500);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return json({error:"unauthorized"},401);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const id=String(body?.id||"");
  if(!id)return json({error:"id_required"},400);
  const {error}=await supabase.from("gmp_notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("user_id",user.id);
  if(error)return json({error:error.message},400);
  return json({success:true});
}
