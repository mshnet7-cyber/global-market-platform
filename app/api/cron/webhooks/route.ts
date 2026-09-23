import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { deliverWebhookAttempt } from "../../../../lib/webhooks";

export const runtime="nodejs";

// Keep each invocation below Cloudflare Workers subrequest limits: each webhook may perform
// two DNS-over-HTTPS resolutions, one delivery request, and one database update.
const CF_SAFE_BATCH_LIMIT = 10;

async function run(request:Request){
  const secret=process.env.CRON_SECRET?.trim() || process.env.GMP_CRON_SECRET?.trim();
  const provided=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"") || request.headers.get("x-cron-secret");
  if(!secret || !provided || provided!==secret) return NextResponse.json({error:"unauthorized"},{status:401});
  const admin=createSupabaseAdminClient();
  if(!admin) return NextResponse.json({error:"service_not_configured"},{status:503});
  const {data,error}=await admin.rpc("gmp_claim_due_webhook_deliveries",{p_limit:CF_SAFE_BATCH_LIMIT});
  if(error) return NextResponse.json({error:error.message},{status:503});
  let processed=0,delivered=0;
  for(const row of data??[]){
    processed++;
    if(await deliverWebhookAttempt(admin,row)) delivered++;
  }
  return NextResponse.json({success:true,processed,delivered,failed:processed-delivered});
}


export async function GET(request:Request){ return run(request); }
export async function POST(request:Request){ return run(request); }
