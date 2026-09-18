import{NextResponse}from"next/server";
import{authenticateApiKey,apiCorsHeaders}from"../../../../../lib/api-keys";
import{appConfig,countries,isValidLanguage}from"../../../../../lib/config";
import{getSnapshot}from"../../../../../lib/providers";
import{withTrustStatus}from"../../../../../lib/market-trust";
import{apiV2Headers,recordApiUsage,requestId}from"../../../../../lib/stage3/developer-api";

export async function OPTIONS(){return new NextResponse(null,{status:204,headers:apiCorsHeaders()})}
export async function GET(request:Request){
  const id=requestId(),start=Date.now();
  try{
    const key=await authenticateApiKey(request,"market:read");
    const u=new URL(request.url);
    const lang=u.searchParams.get("language")?.toLowerCase()||appConfig.defaultLanguage;
    const language=isValidLanguage(lang)?lang:appConfig.defaultLanguage;
    const cc=u.searchParams.get("country")?.toUpperCase()||appConfig.defaultCountry;
    const country=countries.find(c=>c.code===cc)||countries.find(c=>c.code===appConfig.defaultCountry)!;
    const currency=u.searchParams.get("currency")?.toUpperCase()||country.currency;
    if(!/^[A-Z]{3}$/.test(currency))return NextResponse.json({error:"invalid_currency",request_id:id},{status:400,headers:apiV2Headers(id)});
    const snapshot=await getSnapshot(currency,language,false,true);
    const data=snapshot.markets.map(withTrustStatus);
    await recordApiUsage({apiKeyId:key.id,organizationId:key.organizationId,requestId:id,route:"/api/v2/market/markets",method:"GET",statusCode:200,latencyMs:Date.now()-start});
    return NextResponse.json({api_version:"2",request_id:id,generated_at:snapshot.generatedAt,country:country.code,currency,count:data.length,data},{headers:apiV2Headers(id)});
  }catch(e){
    const m=e instanceof Error?e.message:"api_error";
    const s=m==="api_key_required"||m==="api_key_invalid"?401:m==="api_scope_denied"?403:m==="api_rate_limited"?429:503;
    return NextResponse.json({error:m,request_id:id,api_version:"2"},{status:s,headers:apiV2Headers(id)});
  }
}
