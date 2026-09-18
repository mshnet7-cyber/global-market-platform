import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";
import { buildInvoicePayload, getEInvoiceStatus, validateInvoicePayload } from "../../../../lib/stage3/einvoice";

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"cache-control":"no-store","x-gmp-einvoice-canonical":"merchant-invoicing"}});

export async function GET(){
  try{await requireMerchantPlan(["business"]);return json({capability:"einvoice",canonical_endpoint:"/api/merchant/invoicing",...getEInvoiceStatus()})}
  catch(e){return json({error:e instanceof Error?e.message:"unauthorized"},401)}
}

export async function POST(request:Request){
  try{
    const { organization }=await requireMerchantPlan(["business"]);
    const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
    if(!body)return json({error:"invalid_json"},400);
    const action=String(body.action??"validate");
    if(action==="validate"){
      const payload=buildInvoicePayload({
        countryCode:String(body.country_code??"OM").toUpperCase().slice(0,2),
        invoiceNumber:String(body.invoice_number??("SALE-"+String(body.sale_id??"PREVIEW"))),
        currency:String(body.currency??"OMR"),
        supplier:(body.supplier&&typeof body.supplier==="object"?body.supplier:{} ) as Record<string,unknown>,
        customer:(body.customer&&typeof body.customer==="object"?body.customer:{} ) as Record<string,unknown>,
        lines:Array.isArray(body.lines)?body.lines as Array<Record<string,unknown>>:[],
        totals:(body.totals&&typeof body.totals==="object"?body.totals:{} ) as Record<string,unknown>
      });
      validateInvoicePayload(payload);
      return json({valid:true,integration:getEInvoiceStatus(),payload});
    }
    const saleId=String(body.sale_id??"");
    if(!saleId)return json({error:"sale_id_required"},400);
    const canonicalUrl=new URL("/api/merchant/invoicing",request.url);
    const headers=new Headers({"content-type":"application/json"});
    const cookie=request.headers.get("cookie");if(cookie)headers.set("cookie",cookie);
    const queueBody={...body,action:"queue",idempotency_key:String(body.idempotency_key??("stage3:"+organization.id+":"+saleId+":"+String(body.country_code??"OM").toUpperCase()))};
    const queued=await fetch(canonicalUrl,{method:"POST",headers,body:JSON.stringify(queueBody),cache:"no-store"});
    const queuedData=await queued.json().catch(()=>({error:"canonical_invoice_api_invalid_response"}));
    if(!queued.ok)return json({...queuedData,canonical_endpoint:"/api/merchant/invoicing"},queued.status);
    if(action==="queue")return json({...queuedData,canonical_endpoint:"/api/merchant/invoicing"},queued.status);
    const submissionId=String(queuedData.row?.id??queuedData.submission_id??"");
    if(!submissionId)return json({error:"canonical_submission_missing"},502);
    const sent=await fetch(canonicalUrl,{method:"POST",headers,body:JSON.stringify({action:"send",submission_id:submissionId}),cache:"no-store"});
    const sentData=await sent.json().catch(()=>({error:"canonical_invoice_send_invalid_response"}));
    return json({...sentData,submission_id:submissionId,canonical_endpoint:"/api/merchant/invoicing"},sent.status);
  }catch(e){
    const m=e instanceof Error?e.message:"unexpected_error";
    return json({error:m},m==="merchant_plan_required"?403:500);
  }
}
