import { NextResponse } from "next/server";
import { authenticateApiKey, apiCorsHeaders } from "../../../../lib/api-keys";
import { appConfig, countries, isValidLanguage } from "../../../../lib/config";
import { getSnapshot } from "../../../../lib/providers";
import { assessQuote } from "../../../../lib/market-trust";
import { randomUUID } from "crypto";
import { recordApiUsage } from "../../../../lib/stage3/developer-api";

function errorResponse(error: unknown) {
  const message=error instanceof Error?error.message:"api_error";
  const status=message==="api_key_required"||message==="api_key_invalid"?401:message==="api_scope_denied"?403:message==="api_rate_limited"?429:503;
  return NextResponse.json({error:message,request_id:randomUUID()},{status,headers:{...apiCorsHeaders(),"retry-after":status===429?"60":"0"}});
}

export async function OPTIONS(){return new NextResponse(null,{status:204,headers:apiCorsHeaders()});}

export async function GET(request:Request){
  const start=Date.now();
  try{
    const key=await authenticateApiKey(request,"market:read");
    const url=new URL(request.url);
    const lang=url.searchParams.get("language")?.toLowerCase()??appConfig.defaultLanguage;
    const language=isValidLanguage(lang)?lang:appConfig.defaultLanguage;
    const code=url.searchParams.get("country")?.toUpperCase()??appConfig.defaultCountry;
    const country=countries.find(c=>c.code===code)||countries.find(c=>c.code===appConfig.defaultCountry)!;
    const currency=(url.searchParams.get("currency")?.toUpperCase()??country.currency);
    if(!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({error:"invalid_currency",request_id:randomUUID()},{status:400,headers:apiCorsHeaders()});
    const snapshot=await getSnapshot(currency,language,false,false);
    const trust=assessQuote(snapshot.gold);
    const requestId=randomUUID(); await recordApiUsage({apiKeyId:key.id,organizationId:key.organizationId,requestId,route:"/api/v1/gold",method:"GET",statusCode:200,latencyMs:Date.now()-start,apiVersion:"1"}); return NextResponse.json({api_version:"1",request_id:requestId,generated_at:snapshot.generatedAt,data:snapshot.gold,trust:{status:trust.status,trusted:trust.trusted,reason:trust.reason,age_ms:trust.ageMs},source:{provider:snapshot.gold.provider,timestamp:snapshot.gold.timestamp}}, {headers:apiCorsHeaders()});
  }catch(error){return errorResponse(error);}
}
