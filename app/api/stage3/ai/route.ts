import { isSameOriginRequest } from "../../../../lib/request-security";
import { readBoundedRequestJson } from "../../../../lib/bounded-body";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireMerchantPlan } from "../../../../lib/merchant-access";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { askCopilot, extractDocumentFields, getAiStatus } from "../../../../lib/stage3/ai";
import { recordAuditEvent } from "../../../../lib/provider-observability";

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"cache-control":"no-store"}});
export async function GET(){try{await requireMerchantPlan(["business"]);return json({capability:"ai_copilot_ocr",...getAiStatus()})}catch(e){return json({error:e instanceof Error?e.message:"unauthorized"},401)}}
export async function POST(request:Request){
  if (!isSameOriginRequest(request)) return new Response(JSON.stringify({ error: "cross_site_request" }), { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } });

 try{
  const {supabase,organization,user}=await requireMerchantPlan(["business"]);
  const b=await readBoundedRequestJson(request, 64 * 1024).catch(()=>null) as Record<string,unknown>|null;if(!b)return json({error:"invalid_json"},400);
  const action=String(b.action||"");
  if(action==="ocr"){
   const id=String(b.document_id||"");if(!id)return json({error:"document_id_required"},400);
   const {data:doc}=await supabase.from("gmp_documents").select("id,organization_id,storage_path,content_type,language,document_type").eq("id",id).eq("organization_id",organization.id).maybeSingle();
   if(!doc)return json({error:"document_not_found"},404);
   const bucket=process.env.GMP_DOCUMENTS_BUCKET?.trim();if(!bucket)return json({error:"documents_bucket_not_configured",integration_state:"integration_ready"},503);
   if(getAiStatus().state!=="live")return json({error:"ai_not_configured",integration_state:"integration_ready"},503);
   const admin=createSupabaseAdminClient();if(!admin)return json({error:"service_not_configured"},503);
   const {data:signed}=await admin.storage.from(bucket).createSignedUrl(doc.storage_path,300);if(!signed?.signedUrl)return json({error:"document_url_unavailable"},503);
   const inputHash=createHash("sha256").update(doc.storage_path).digest("hex");
   const {data:job,error:jobError}=await admin.from("gmp_ai_jobs").insert({organization_id:organization.id,document_id:doc.id,job_type:"ocr",status:"running",provider:getAiStatus().provider,model:getAiStatus().model,input_hash:inputHash,created_by:user.id}).select("id").single();
   if(jobError)return json({error:jobError.message},400);
   try{
    const result=await extractDocumentFields({sourceUrl:signed.signedUrl,contentType:doc.content_type,language:doc.language,documentType:doc.document_type});
    const confidence=typeof result.confidence==="number"?result.confidence:null;
    const status=confidence!==null&&confidence<0.8?"needs_review":"succeeded";
    await admin.from("gmp_ai_jobs").update({status,result,confidence,updated_at:new Date().toISOString()}).eq("id",job.id);
    await supabase.from("gmp_documents").update({ai_extracted_data:result,ai_confidence:confidence,review_status:status==="needs_review"?"needs_review":"pending"}).eq("id",doc.id).eq("organization_id",organization.id);
    await recordAuditEvent({action:"stage3.ai.ocr",organizationId:organization.id,userId:user.id,entityType:"document",entityId:doc.id,metadata:{job_id:job.id,confidence}});
    return json({success:true,job_id:job.id,confidence,result});
   }catch(e){
    await admin.from("gmp_ai_jobs").update({status:"failed",error_code:"provider_error",error_message:e instanceof Error?e.message.slice(0,500):"provider_error",retry_count:1,updated_at:new Date().toISOString()}).eq("id",job.id);
    return json({error:"ai_provider_failed",job_id:job.id,retryable:true},502);
   }
  }
  if(action==="copilot"){
   const question=String(b.question||"").trim();if(question.length<2)return json({error:"question_required"},400);
   const [sales,purchases,expenses,repairs]=await Promise.all([
    supabase.from("gmp_sales").select("id",{count:"exact",head:true}).eq("organization_id",organization.id),
    supabase.from("gmp_purchases").select("id",{count:"exact",head:true}).eq("organization_id",organization.id),
    supabase.from("gmp_expenses").select("id",{count:"exact",head:true}).eq("organization_id",organization.id),
    supabase.from("gmp_repair_orders").select("id",{count:"exact",head:true}).eq("organization_id",organization.id)
   ]);
   const context={sales:sales.count??0,purchases:purchases.count??0,expenses:expenses.count??0,repairs:repairs.count??0};
   if(getAiStatus().state!=="live")return json({error:"ai_not_configured",integration_state:"integration_ready",context},503);
   const admin=createSupabaseAdminClient();if(!admin)return json({error:"service_not_configured"},503);
   const inputHash=createHash("sha256").update(question).digest("hex");
   const {data:job,error:jobError}=await admin.from("gmp_ai_jobs").insert({organization_id:organization.id,job_type:"copilot",status:"running",provider:getAiStatus().provider,model:getAiStatus().model,input_hash:inputHash,created_by:user.id}).select("id").single();
   if(jobError)return json({error:jobError.message},400);
   try{
    const result=await askCopilot({question,context:{organization_id:organization.id,...context}});
    await admin.from("gmp_ai_jobs").update({status:"succeeded",result,updated_at:new Date().toISOString()}).eq("id",job.id).eq("organization_id",organization.id);
    await recordAuditEvent({action:"stage3.ai.copilot",organizationId:organization.id,userId:user.id,entityType:"ai_job",entityId:job.id,metadata:{question_hash:inputHash.slice(0,16)}});
    return json({success:true,job_id:job.id,result});
   }catch(e){
    await admin.from("gmp_ai_jobs").update({status:"failed",error_code:"provider_error",error_message:e instanceof Error?e.message.slice(0,500):"provider_error",retry_count:1,updated_at:new Date().toISOString()}).eq("id",job.id).eq("organization_id",organization.id);
    return json({error:"ai_provider_failed",job_id:job.id,retryable:true},502);
   }
  }
  return json({error:"unsupported_action"},400);
 }catch(e){const m=e instanceof Error?e.message:"unexpected_error";return json({error:m},m==="merchant_plan_required"?403:500)}
}
