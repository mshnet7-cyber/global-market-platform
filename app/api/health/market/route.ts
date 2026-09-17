import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export async function GET() {
  const admin=createSupabaseAdminClient();
  if(!admin) return NextResponse.json({ok:false,status:"unconfigured"},{status:503});
  const {data:providers,error}=await admin.from("gmp_data_providers").select("code,name,enabled,commercial_use,public_display,customer_display,redistribution,realtime").order("name");
  if(error) return NextResponse.json({ok:false,status:"database_error"},{status:503});
  const {data:status}=await admin.from("gmp_provider_status").select("provider_id,status,success_count,failure_count,last_success_at,last_failure_at,updated_at");
  return NextResponse.json({ok:true,generated_at:new Date().toISOString(),providers:providers??[],status:status??[]},{headers:{"cache-control":"no-store"}});
}
