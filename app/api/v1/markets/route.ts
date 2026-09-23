import { NextResponse } from "next/server";
import { authenticateApiKey, apiCorsHeaders } from "../../../../lib/api-keys";
import { appConfig, isValidLanguage } from "../../../../lib/config";
import { getSnapshot } from "../../../../lib/providers";
import { withTrustStatus } from "../../../../lib/market-trust";
import { randomUUID } from "crypto";
import { recordApiUsage } from "../../../../lib/stage3/developer-api";
import type { Quote } from "../../../../lib/types";

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
    const languageParam=url.searchParams.get("language")?.toLowerCase()??appConfig.defaultLanguage;
    const language=isValidLanguage(languageParam)?languageParam:appConfig.defaultLanguage;
    const kind=url.searchParams.get("kind")==="stocks"?"stocks":"markets";
    const instrument=url.searchParams.get("instrument")?.toUpperCase()??null;
    const country=url.searchParams.get("country")?.toUpperCase()||appConfig.defaultCountry; const currency=(url.searchParams.get("currency")?.toUpperCase()||"USD"); if(!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({error:"invalid_currency",request_id:randomUUID()},{status:400,headers:apiCorsHeaders()}); const snapshot=await getSnapshot(currency,language,false,true);
    const quotes=(kind==="stocks"?snapshot.stocks:snapshot.markets).map(withTrustStatus).filter((q: Quote)=>!instrument||q.symbol===instrument||q.instrument.toUpperCase().includes(instrument));
    const requestId=randomUUID(); await recordApiUsage({apiKeyId:key.id,organizationId:key.organizationId,requestId,route:"/api/v1/markets",method:"GET",statusCode:200,latencyMs:Date.now()-start,apiVersion:"1"}); return NextResponse.json({api_version:"1",request_id:requestId,generated_at:snapshot.generatedAt,kind,country,count:quotes.length,data:quotes}, {headers:apiCorsHeaders()});
  }catch(error){return errorResponse(error);}
}
