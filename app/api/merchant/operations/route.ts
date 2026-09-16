import { NextResponse } from "next/server";
import { requireMerchantPlan } from "../../../../lib/merchant-access";

const plans: Record<string, ("pro" | "business")[]> = { purchases: ["pro", "business"], expenses: ["pro", "business"], repairs: ["business"], "buy-gold": ["business"], inventory: ["business"], accounting: ["pro", "business"], tax: ["business"] };
const methods = new Set(["cash", "bank", "card", "wallet", "other"]);
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
type JournalLine = { account_id: string; debit: number; credit: number; memo: string | null };

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const moduleName = url.searchParams.get("module") ?? ""; const access = plans[moduleName];
    if (!access) return NextResponse.json({ error: "invalid_module" }, { status: 404 });
    const { supabase, organization } = await requireMerchantPlan(access); const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20) || 20, 1), 100);
    if (moduleName === "accounting") {
      const [{ data: accounts }, { data: entries }] = await Promise.all([
        supabase.from("gmp_accounts").select("id,code,name,account_type,system_key,active").eq("organization_id", organization.id).order("code"),
        supabase.from("gmp_journal_entries").select("id,entry_no,description,entry_date,reference_type,reference_id,status,created_at").eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(limit),
      ]); return NextResponse.json({ accounts: accounts ?? [], entries: entries ?? [] });
    }
    if (moduleName === "tax") {
      const from = url.searchParams.get("from") ?? new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString().slice(0, 10); const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
      const [{ data: sales }, { data: expenses }] = await Promise.all([
        supabase.from("gmp_sales").select("id,invoice_no,subtotal,vat_amount,total,issued_at,status").eq("organization_id", organization.id).gte("issued_at", `${from}T00:00:00.000Z`).lte("issued_at", `${to}T23:59:59.999Z`).neq("status", "voided"),
        supabase.from("gmp_expenses").select("id,category,amount,vat_amount,expense_date,status").eq("organization_id", organization.id).gte("expense_date", from).lte("expense_date", to).neq("status", "voided"),
      ]);
      const outputVat=(sales??[]).reduce((s,x)=>s+Number(x.vat_amount??0),0), inputVat=(expenses??[]).reduce((s,x)=>s+Number(x.vat_amount??0),0), salesTotal=(sales??[]).reduce((s,x)=>s+Number(x.total??0),0), expensesTotal=(expenses??[]).reduce((s,x)=>s+Number(x.amount??0),0);
      return NextResponse.json({ from,to,summary:{output_vat:outputVat,input_vat:inputVat,net_vat:outputVat-inputVat,sales_total:salesTotal,expenses_total:expensesTotal},sales:sales??[],expenses:expenses??[] });
    }
    const table: Record<string,string>={purchases:"gmp_purchases",expenses:"gmp_expenses",repairs:"gmp_repair_orders","buy-gold":"gmp_person_gold_purchases",inventory:"gmp_products"};
    const { data,error }=await supabase.from(table[moduleName]).select("*").eq("organization_id",organization.id).order("created_at",{ascending:false}).limit(limit);
    if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({rows:data??[]});
  } catch(error){const message=error instanceof Error?error.message:"unexpected_error";return NextResponse.json({error:message},{status:message==="merchant_plan_required"?403:500});}
}

export async function POST(request: Request) {
  try {
    const body=await request.json(); const moduleName=String(body.module??""); const access=plans[moduleName]; if(!access)return NextResponse.json({error:"invalid_module"},{status:404});
    const {supabase,user,organization}=await requireMerchantPlan(access);
    if(moduleName==="expenses"){
      if(body.action==="void"){
        const id=String(body.id??""),reason=String(body.reason??"").trim(); if(!id||!reason)return NextResponse.json({error:"expense_id_and_reason_required"},{status:400});
        const {data,error}=await supabase.from("gmp_expenses").update({status:"voided",voided_at:new Date().toISOString(),voided_by:user.id,void_reason:reason.slice(0,500)}).eq("id",id).eq("organization_id",organization.id).eq("status","posted").select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({success:true,row:data});
      }
      const category=String(body.category??"").trim(),amount=num(body.amount),vatAmount=num(body.vat_amount??0); if(!category||amount===null||amount<=0||vatAmount===null||vatAmount<0)return NextResponse.json({error:"invalid_expense"},{status:400});
      const {data,error}=await supabase.from("gmp_expenses").insert({organization_id:organization.id,branch_id:body.branch_id||null,category:category.slice(0,120),description:body.description?String(body.description).slice(0,1000):null,amount,vat_amount:vatAmount,expense_date:body.expense_date||undefined,created_by:user.id}).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({success:true,row:data},{status:201});
    }
    if(moduleName==="repairs"){
      if(body.action==="status"){
        const id=String(body.id??""),status=String(body.status??""); const allowed=["received","in_repair","ready","delivered","cancelled"]; if(!id||!allowed.includes(status))return NextResponse.json({error:"invalid_repair_status"},{status:400});
        const patch:Record<string,unknown>={status,updated_at:new Date().toISOString()}; if(status==="ready")patch.ready_at=new Date().toISOString(); if(status==="delivered"){patch.delivered_at=new Date().toISOString();patch.delivered_by=user.id;}
        const {data,error}=await supabase.from("gmp_repair_orders").update(patch).eq("id",id).eq("organization_id",organization.id).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({success:true,row:data});
      }
      const description=String(body.item_description??"").trim(),weight=num(body.weight_received_grams); if(!description||weight===null||weight<0)return NextResponse.json({error:"invalid_repair"},{status:400});
      const {data,error}=await supabase.from("gmp_repair_orders").insert({organization_id:organization.id,branch_id:body.branch_id||null,customer_id:body.customer_id||null,item_description:description.slice(0,500),metal:body.metal?String(body.metal).slice(0,40):null,karat:body.karat?String(body.karat).slice(0,20):null,weight_received_grams:weight,damage_description:body.damage_description?String(body.damage_description).slice(0,1000):null,repair_type:body.repair_type?String(body.repair_type).slice(0,120):null,expected_days:num(body.expected_days),amount:num(body.amount)??0,notes:body.notes?String(body.notes).slice(0,1000):null,created_by:user.id}).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({success:true,row:data},{status:201});
    }
    if(moduleName==="buy-gold"){
      const name=String(body.seller_name??"").trim(),phone=String(body.seller_phone??"").trim(),identity=String(body.identity_document_path??"").trim(),weight=num(body.weight_grams),price=num(body.purchase_price); if(!name||!phone||!identity||weight===null||weight<=0||price===null||price<=0)return NextResponse.json({error:"invalid_person_gold_purchase"},{status:400});
      const {data,error}=await supabase.from("gmp_person_gold_purchases").insert({organization_id:organization.id,branch_id:body.branch_id||null,seller_name:name.slice(0,200),seller_phone:phone.slice(0,40),identity_document_path:identity.slice(0,1000),item_description:body.item_description?String(body.item_description).slice(0,500):null,karat:body.karat?String(body.karat).slice(0,20):null,weight_grams:weight,market_reference_price:num(body.market_reference_price),purchase_price:price,payment_method:methods.has(String(body.payment_method))?String(body.payment_method):"cash",created_by:user.id}).select("*").single(); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({success:true,row:data},{status:201});
    }
    if(moduleName==="inventory"){
      if(body.action==="create"){
        const name=String(body.name??"").trim(),storeId=String(body.store_id??""),price=num(body.price??0); if(!name||!storeId||price===null||price<0)return NextResponse.json({error:"invalid_product"},{status:400});
        const {data,error}=await supabase.rpc("gmp_create_inventory_product",{p_organization_id:organization.id,p_store_id:storeId,p_name:name,p_sku:body.sku?String(body.sku).slice(0,80):null,p_barcode:body.barcode?String(body.barcode).slice(0,80):null,p_category:body.category?String(body.category).slice(0,100):null,p_karat:body.karat?String(body.karat).slice(0,20):null,p_price:price,p_cost_price:num(body.cost_price??0)??0,p_making_charge:num(body.making_charge??0)??0,p_initial_quantity:Math.max(0,num(body.current_quantity??0)??0),p_initial_weight:Math.max(0,num(body.current_weight_grams??0)??0)});
        if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data,{status:201});
      }
      if(body.action==="adjust"){
        const productId=String(body.product_id??""),qty=num(body.quantity_delta),weight=num(body.weight_delta??0),unitCost=num(body.unit_cost??0); if(!productId||qty===null||weight===null||unitCost===null||unitCost<0)return NextResponse.json({error:"invalid_inventory_adjustment"},{status:400});
        const {data,error}=await supabase.rpc("gmp_adjust_inventory",{p_organization_id:organization.id,p_product_id:productId,p_quantity_delta:qty,p_weight_delta:weight,p_unit_cost:unitCost,p_movement_type:body.movement_type?String(body.movement_type).slice(0,40):"adjustment"}); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data);
      }
      return NextResponse.json({error:"unsupported_inventory_operation"},{status:400});
    }
    if(moduleName==="purchases"){
      const storeId=String(body.store_id??""),lines=Array.isArray(body.lines)?body.lines:[]; if(!storeId||!lines.length)return NextResponse.json({error:"store_and_lines_required"},{status:400});
      const normalized=[]; for(const raw of lines){const quantity=num(raw.quantity),unitCost=num(raw.unit_cost),lineVat=num(raw.vat_amount??0),weight=num(raw.weight_grams??0),making=num(raw.making_charge??0); if(!raw.raw_description||quantity===null||quantity<=0||unitCost===null||unitCost<0||lineVat===null||lineVat<0||weight===null||weight<0||making===null||making<0)return NextResponse.json({error:"invalid_purchase_line"},{status:400}); normalized.push({product_id:raw.product_id||null,raw_description:String(raw.raw_description).slice(0,500),sku:raw.sku?String(raw.sku).slice(0,80):null,barcode:raw.barcode?String(raw.barcode).slice(0,80):null,karat:raw.karat?String(raw.karat).slice(0,20):null,country_of_origin:raw.country_of_origin?String(raw.country_of_origin).slice(0,80):null,quantity,weight_grams:weight,unit_cost:unitCost,making_charge:making,vat_amount:lineVat});}
      const {data,error}=await supabase.rpc("gmp_create_purchase",{p_organization_id:organization.id,p_branch_id:body.branch_id||null,p_store_id:storeId,p_supplier_id:body.supplier_id||null,p_invoice_no:body.invoice_no?String(body.invoice_no).slice(0,80):null,p_lines:normalized});
      if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data,{status:201});
    }
    if(moduleName==="accounting"){
      const lines=Array.isArray(body.lines)?body.lines:[]; const description=String(body.description??"").trim(); if(!description||lines.length<2)return NextResponse.json({error:"journal_required"},{status:400});
      const normalized: JournalLine[]=lines.map((line:Record<string,unknown>)=>({account_id:String(line.account_id??""),debit:num(line.debit??0)??-1,credit:num(line.credit??0)??-1,memo:line.memo?String(line.memo).slice(0,500):null}));
      if(normalized.some((l:JournalLine)=>!l.account_id||l.debit<0||l.credit<0||(l.debit>0&&l.credit>0)||(l.debit===0&&l.credit===0)))return NextResponse.json({error:"invalid_journal_line"},{status:400});
      const {data,error}=await supabase.rpc("gmp_create_manual_journal",{p_organization_id:organization.id,p_branch_id:body.branch_id||null,p_description:description.slice(0,500),p_entry_date:body.entry_date||null,p_lines:normalized}); if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json(data,{status:201});
    }
    return NextResponse.json({error:"unsupported_operation"},{status:400});
  } catch(error){const message=error instanceof Error?error.message:"unexpected_error";return NextResponse.json({error:message},{status:message==="merchant_plan_required"?403:500});}
}
