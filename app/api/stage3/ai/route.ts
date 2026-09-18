import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireMerchantPlan } from "../../../../lib/merchant-access";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { askCopilot, extractDocumentFields, getAiStatus } from "../../../../lib/stage3/ai";
import { recordAuditEvent } from "../../../../lib/provider-observability";

function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } }); }

export async function GET() {
  try {
    await requireMerchantPlan(["business"]);
    return json({ capability: "ai_copilot_ocr", ...getAiStatus() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unauthorized" }, 401);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, organization, user } = await requireMerchantPlan(["business"]);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ error: "invalid_json" }, 400);
    const action = String(body.action || "");
    const admin = createSupabaseAdminClient();
    if (!admin) return json({ error: "service_not_configured" }, 503);

    if (action === "ocr") {
      const documentId = String(body.document_id || "");
      if (!documentId) return json({ error: "document_id_required" }, 400);
      const { data: document } = await supabase.from("gmp_documents").select("id,organization_id,storage_path,content_type,language,document_type").eq("id", documentId).eq("organization_id", organization.id).maybeSingle();
      if (!document) return json({ error: "document_not_found" }, 404);
      const bucket = process.env.GMP_DOCUMENTS_BUCKET?.trim();
      if (!bucket) return json({ error: "documents_bucket_not_configured", integration_state: "integration_ready" }, 503);
      if (!getAiStatus().provider) return json({ error: "ai_not_configured", integration_state: "integration_ready" }, 503);
      const { data: signed } = await admin.storage.from(bucket).createSignedUrl(document.storage_path, 300);
      if (!signed?.signedUrl) return json({ error: "document_url_unavailable" }, 503);
      const inputHash = createHash("sha256").update(document.storage_path).digest("hex");
      const { data: job, error: jobError } = await admin.from("gmp_ai_jobs").insert({
        organization_id: organization.id, document_id: document.id, job_type: "ocr", status: "running",
        provider: getAiStatus().provider, model: getAiStatus().model, input_hash: inputHash, created_by: user.id
      }).select("id").single();
      if (jobError) return json({ error: jobError.message }, 400);
      try {
        const result = await extractDocumentFields({ sourceUrl: signed.signedUrl, contentType: document.content_type, language: document.language, documentType: document.document_type });
        const confidence = typeof result.confidence === "number" ? result.confidence : null;
        await admin.from("gmp_ai_jobs").update({ status: confidence !== null && confidence < 0.8 ? "needs_review" : "succeeded", result, confidence, updated_at: new Date().toISOString() }).eq("id", job.id);
        await supabase.from("gmp_documents").update({ ai_extracted_data: result, ai_confidence: confidence, review_status: confidence !== null && confidence < 0.8 ? "needs_review" : "pending" }).eq("id", document.id).eq("organization_id", organization.id);
        await recordAuditEvent({ action:"stage3.ai.ocr", organizationId:organization.id, userId:user.id, entityType:"document", entityId:document.id, metadata:{job_id:job.id,confidence} });
        return json({ success:true, job_id:job.id, confidence, result });
      } catch (error) {
        await admin.from("gmp_ai_jobs").update({ status:"failed", error_code:"provider_error", error_message:error instanceof Error ? error.message.slice(0,300) : "provider_error", retry_count:1, updated_at:new Date().toISOString() }).eq("id",job.id);
        return json({ error:"ai_provider_failed", job_id:job.id, retryable:true }, 502);
      }
    }

    if (action === "copilot") {
      const question = String(body.question || "").trim();
      if (question.length < 2) return json({ error: "question_required" }, 400);
      const counts = await Promise.all([
        supabase.from("gmp_sales").select("id",{count:"exact",head:true}).eq("organization_id",organization.id),
        supabase.from("gmp_purchases").select("id",{count:"exact",head:true}).eq("organization_id",organization.id),
        supabase.from("gmp_expenses").select("id",{count:"exact",head:true}).eq("organization_id",organization.id),
        supabase.from("gmp_repair_orders").select("id",{count:"exact",head:true}).eq("organization_id",organization.id),
      ]);
      if (getAiStatus().state !== "live") return json({ error:"ai_not_configured", integration_state:"integration_ready", context:{sales:counts[0].count??0,purchases:counts[1].count??0,expenses:counts[2].count??0,repairs:counts[3].count??0} },503);
      const result = await askCopilot({ question, context:{organization_id:organization.id,sales:counts[0].count??0,purchases:counts[1].count??0,expenses:counts[2].count??0,repairs:counts[3].count??0} });
      await recordAuditEvent({ action:"stage3.ai.copilot", organizationId:organization.id, userId:user.id, entityType:"ai_job", metadata:{question_hash:createHash("sha256").update(question).digest("hex").slice(0,16)} });
      return json({ success:true, result });
    }

    return json({ error: "unsupported_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return json({ error: message }, message === "merchant_plan_required" ? 403 : 500);
  }
}
