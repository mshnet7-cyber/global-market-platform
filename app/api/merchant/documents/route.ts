import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { requireMerchantPlan } from "../../../../lib/merchant-access";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { extractDocumentFields, getAiStatus } from "../../../../lib/stage3/ai";
import { recordAuditEvent } from "../../../../lib/provider-observability";

const BUCKET=process.env.GMP_DOCUMENTS_BUCKET?.trim() || "gmp-documents";
const MAX_BYTES=10*1024*1024;
const TYPES=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

function matchesFileSignature(type:string, bytes:Uint8Array) {
  if (type === "application/pdf") return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0,5)) === "%PDF-";
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.length >= 8 && bytes.slice(0,8).every((value,index) => value === [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a][index]);
  if (type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  return false;
}

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"cache-control":"no-store"}});

export async function GET(){
  try{
    const {supabase,organization}=await requireMerchantPlan(["business"]);
    const {data,error}=await supabase.from("gmp_documents").select("id,branch_id,document_type,storage_path,content_type,file_hash,language,ai_extracted_data,ai_confidence,review_status,reviewed_by,reviewed_at,created_at").eq("organization_id",organization.id).order("created_at",{ascending:false}).limit(100);
    if(error)return json({error:error.message},400);
    return json({documents:data??[],integration:getAiStatus()});
  }catch(e){const m=e instanceof Error?e.message:"unauthorized";return json({error:m},m==="merchant_plan_required"?403:401);}
}

export async function POST(request:Request){
  try{
    const {supabase,organization,user}=await requireMerchantPlan(["business"]);
    const admin=createSupabaseAdminClient(); if(!admin)return json({error:"service_not_configured"},503);
    const form=await request.formData();
    const action=String(form.get("action")??"upload");
    if(action==="upload"){
      const file=form.get("file");
      if(!(file instanceof File))return json({error:"file_required"},400);
      if(file.size<=0||file.size>MAX_BYTES)return json({error:"file_size_invalid",max_bytes:MAX_BYTES},400);
      if(!TYPES.has(file.type))return json({error:"file_type_invalid",allowed:Array.from(TYPES)},400);
      const documentType=String(form.get("document_type")??"other");
      if(!["identity","supplier_invoice","expense_receipt","repair_photo","other"].includes(documentType))return json({error:"document_type_invalid"},400);
      const branchId=String(form.get("branch_id")??"").trim()||null;
      if(branchId){const {data:branch}=await supabase.from("gmp_branches").select("id").eq("id",branchId).eq("organization_id",organization.id).maybeSingle();if(!branch)return json({error:"branch_not_found"},400);}
      const bytes=new Uint8Array(await file.arrayBuffer());
      if (!matchesFileSignature(file.type, bytes)) return json({error:"file_signature_invalid"},400);
      const hash=createHash("sha256").update(bytes).digest("hex");
      const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
      const path=`${organization.id}/${new Date().toISOString().slice(0,10)}/${randomUUID()}.${ext||"bin"}`;
      const up=await admin.storage.from(BUCKET).upload(path,bytes,{contentType:file.type,upsert:false});
      if(up.error)return json({error:"storage_upload_failed",detail:up.error.message},502);
      const {data:doc,error}=await supabase.from("gmp_documents").insert({organization_id:organization.id,branch_id:branchId,document_type:documentType,storage_path:path,file_hash:hash,content_type:file.type,language:String(form.get("language")??"ar").slice(0,10),created_by:user.id}).select("id,document_type,content_type,review_status,created_at").single();
      if(error){await admin.storage.from(BUCKET).remove([path]);return json({error:error.message},400);}
      await recordAuditEvent({action:"document.uploaded",organizationId:organization.id,userId:user.id,entityType:"document",entityId:doc.id});
      return json({success:true,document:doc,storage:"private",ocr_available:getAiStatus().state==="live"},201);
    }
    const documentId=String(form.get("document_id")??"");
    if(!documentId)return json({error:"document_id_required"},400);
    const {data:doc}=await supabase.from("gmp_documents").select("*").eq("id",documentId).eq("organization_id",organization.id).maybeSingle();
    if(!doc)return json({error:"document_not_found"},404);
    if(action==="ocr"){
      if(getAiStatus().state!=="live")return json({error:"ai_not_configured",integration_state:"integration_ready"},503);
      const {data:signed}=await admin.storage.from(BUCKET).createSignedUrl(doc.storage_path,300);
      if(!signed?.signedUrl)return json({error:"document_url_unavailable"},503);
      const {data:job,error:jobError}=await admin.from("gmp_ai_jobs").insert({organization_id:organization.id,document_id:doc.id,job_type:"ocr",status:"running",provider:getAiStatus().provider,model:getAiStatus().model,input_hash:doc.file_hash,created_by:user.id}).select("id").single();
      if(jobError)return json({error:jobError.message},400);
      try{
        const result=await extractDocumentFields({sourceUrl:signed.signedUrl,contentType:doc.content_type,language:doc.language,documentType:doc.document_type});
        const confidence=typeof result.confidence==="number"?result.confidence:null;
        await admin.from("gmp_ai_jobs").update({status:"succeeded",result,confidence,updated_at:new Date().toISOString()}).eq("id",job.id);
        await supabase.from("gmp_documents").update({ai_extracted_data:result,ai_confidence:confidence,review_status:"pending"}).eq("id",doc.id).eq("organization_id",organization.id);
        await recordAuditEvent({action:"document.ocr.completed",organizationId:organization.id,userId:user.id,entityType:"document",entityId:doc.id,metadata:{job_id:job.id,confidence}});
        return json({success:true,status:"pending_review",job_id:job.id,confidence,result});
      }catch(e){
        const message=e instanceof Error?e.message:"provider_error";
        await admin.from("gmp_ai_jobs").update({status:"failed",error_code:"provider_error",error_message:message.slice(0,500),retry_count:1,updated_at:new Date().toISOString()}).eq("id",job.id);
        return json({error:"ai_provider_failed",job_id:job.id,retryable:true},502);
      }
    }
    if(action==="review"){
      const status=String(form.get("status")??"");
      if(!["approved","rejected"].includes(status))return json({error:"invalid_review_status"},400);
      const {data:ok,error}=await admin.rpc("gmp_document_review",{p_document_id:documentId,p_status:status,p_user_id:user.id});
      if(error)return json({error:error.message},400);
      if(ok!==true)return json({error:"review_forbidden_or_not_found"},403);
      await recordAuditEvent({action:`document.review.${status}`,organizationId:organization.id,userId:user.id,entityType:"document",entityId:documentId});
      return json({success:true,status});
    }
    return json({error:"unsupported_action"},400);
  }catch(e){const m=e instanceof Error?e.message:"unexpected_error";return json({error:m},m==="merchant_plan_required"?403:500);}
}
