import { NextResponse } from "next/server";
import { requireStage2Permission } from "../../../lib/stage2-access";
import { isSameOriginRequest } from "../../../lib/request-security";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"cache-control":"no-store"}});
const txt=(v:unknown,n=300)=>String(v??"").trim().slice(0,n);
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?Math.max(0,n):0;};
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
async function belongsToOrg(access:any, table:string, id:string){if(!uuid(id))return false;const {data,error}=await access.supabase.from(table).select("id").eq("id",id).eq("organization_id",access.organization.id).maybeSingle();return !error&&Boolean(data);}
export async function GET(request:Request){
 try{
  const access=await requireStage2Permission("erp.read");
  const q=new URL(request.url).searchParams.get("action")||"all";
  if(q==="all"){
   const [quotes,vouchers,lists,sales,purchases,customers,suppliers,products]=await Promise.all([
    access.supabase.from("gmp_sales_quotes").select("id,quote_no,status,customer_id,store_id,valid_until,subtotal,discount_amount,vat_amount,total,currency,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(200),
    access.supabase.from("gmp_cash_vouchers").select("id,voucher_no,voucher_type,party_type,customer_id,supplier_id,amount,payment_method,reference,voucher_date,status,created_at").eq("organization_id",access.organization.id).order("voucher_date",{ascending:false}).limit(200),
    access.supabase.from("gmp_price_lists").select("id,name,store_id,currency,active,valid_from,valid_until,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(100),
    access.supabase.from("gmp_sales").select("id,invoice_no,customer_id,total,vat_amount,status,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(500),
    access.supabase.from("gmp_purchases").select("id,invoice_no,supplier_id,total,vat_amount,status,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(500),
    access.supabase.from("gmp_customers").select("id,name,phone").eq("organization_id",access.organization.id).order("name"),
    access.supabase.from("gmp_suppliers").select("id,name,phone").eq("organization_id",access.organization.id).order("name"),
    access.supabase.from("gmp_products").select("id,name,sku,store_id").eq("organization_id",access.organization.id).eq("active",true).order("name").limit(1000)
   ]);
   const priceListIds=(lists.data??[]).map((x:any)=>x.id);
   const {data:priceItems}=priceListIds.length?await access.supabase.from("gmp_price_list_items").select("id,price_list_id,product_id,sell_price,buy_price,making_charge,min_quantity,max_quantity").in("price_list_id",priceListIds):{data:[]};
   return json({quotes:quotes.data??[],vouchers:vouchers.data??[],priceLists:lists.data??[],priceItems:priceItems??[],products:products.data??[],sales:sales.data??[],purchases:purchases.data??[],customers:customers.data??[],suppliers:suppliers.data??[]});
  }
  if(q==="statement"){
   const p=new URL(request.url).searchParams,id=txt(p.get("party_id"),80),type=txt(p.get("party_type"),20);
   if(!uuid(id)||!["customer","supplier"].includes(type))return json({error:"party_required"},400);
   const [sales,purchases,vouchers]=await Promise.all([
    type==="customer"?access.supabase.from("gmp_sales").select("invoice_no,total,created_at,status").eq("organization_id",access.organization.id).eq("customer_id",id).order("created_at",{ascending:false}):Promise.resolve({data:[] as any[]}),
    type==="supplier"?access.supabase.from("gmp_purchases").select("invoice_no,total,created_at,status").eq("organization_id",access.organization.id).eq("supplier_id",id).order("created_at",{ascending:false}):Promise.resolve({data:[] as any[]}),
    access.supabase.from("gmp_cash_vouchers").select("voucher_no,voucher_type,amount,voucher_date,reference,status").eq("organization_id",access.organization.id).or(type==="customer"?"customer_id.eq."+id:"supplier_id.eq."+id).order("voucher_date",{ascending:false})
   ]);
   return json({sales:sales.data??[],purchases:purchases.data??[],vouchers:vouchers.data??[]});
  }
  return json({error:"unsupported_action"},400);
 }catch(e){return json({error:e instanceof Error?e.message:"unexpected_error"},500)}
}
export async function POST(request:Request){
 if(!isSameOriginRequest(request))return json({error:"cross_site_request"},403);
 try{
  const access=await requireStage2Permission("erp.write",["business"]),b=await request.json(),action=txt(b.action,50);
  if(action==="quote"){
   const storeId=txt(b.store_id,80);if(!uuid(storeId))return json({error:"store_required"},400);
   if(!(await belongsToOrg(access,"gmp_stores",storeId)))return json({error:"store_not_found"},404);
   const customerId=txt(b.customer_id,80);if(customerId&&!await belongsToOrg(access,"gmp_customers",customerId))return json({error:"customer_not_found"},404);
   const branchId=txt(b.branch_id,80);if(branchId&&!await belongsToOrg(access,"gmp_branches",branchId))return json({error:"branch_not_found"},404);
   const lines=Array.isArray(b.lines)?b.lines.slice(0,100):[];if(!lines.length)return json({error:"lines_required"},400);
   const normalized=lines.map((l:any)=>{const q=num(l.quantity)||1,p=num(l.unit_price),m=num(l.making_charge),d=num(l.discount_amount),v=num(l.vat_amount);return {description:txt(l.description,300),product_id:uuid(txt(l.product_id,80))?txt(l.product_id,80):null,quantity:q,weight_grams:num(l.weight_grams),unit_price:p,making_charge:m,discount_amount:d,vat_amount:v,line_total:Math.max(0,q*p+m-d+v)};});
   const productIds=[...new Set(normalized.map((l:any)=>l.product_id).filter(Boolean))] as string[];
   if(productIds.length){const {data:ownedProducts}=await access.supabase.from("gmp_products").select("id").eq("organization_id",access.organization.id).in("id",productIds);if((ownedProducts??[]).length!==productIds.length)return json({error:"product_not_found"},404);}
   const subtotal=normalized.reduce((s:number,l:any)=>s+l.quantity*l.unit_price+l.making_charge,0),discount=num(b.discount_amount)||normalized.reduce((s:number,l:any)=>s+l.discount_amount,0),vat=num(b.vat_amount)||normalized.reduce((s:number,l:any)=>s+l.vat_amount,0),total=Math.max(0,subtotal-discount+vat);
   const no="QT-"+new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14)+"-"+Math.floor(Math.random()*900+100);
   const {data:quote,error}=await access.supabase.from("gmp_sales_quotes").insert({organization_id:access.organization.id,store_id:storeId,branch_id:branchId&&uuid(branchId)?branchId:null,customer_id:customerId&&uuid(customerId)?customerId:null,quote_no:no,status:"draft",valid_until:txt(b.valid_until,20)||null,currency:txt(b.currency,8)||"OMR",subtotal,discount_amount:discount,vat_amount:vat,total,notes:txt(b.notes,1500)||null,created_by:access.user.id}).select("*").single();
   if(error)return json({error:error.message},400);
   const {error:lineError}=await access.supabase.from("gmp_sales_quote_lines").insert(normalized.map((l:any)=>({...l,quote_id:quote.id})));
   if(lineError){await access.supabase.from("gmp_sales_quotes").delete().eq("id",quote.id);return json({error:lineError.message},400);}
   return json({success:true,row:quote},201);
  }
  if(action==="voucher"){
   const type=txt(b.voucher_type,20);if(!["receipt","payment"].includes(type))return json({error:"voucher_type_required"},400);
   const partyType=txt(b.party_type,20)||"other";if(!["customer","supplier","other"].includes(partyType))return json({error:"party_type_required"},400);
   const customerId=txt(b.customer_id,80),supplierId=txt(b.supplier_id,80);if(partyType==="customer"&&!(await belongsToOrg(access,"gmp_customers",customerId)))return json({error:"customer_not_found"},404);if(partyType==="supplier"&&!(await belongsToOrg(access,"gmp_suppliers",supplierId)))return json({error:"supplier_not_found"},404);
   const amount=num(b.amount);if(amount<=0)return json({error:"amount_required"},400);
   const no=(type==="receipt"?"RV-":"PV-")+new Date().toISOString().replace(/[-:.TZ]/g,"").slice(0,14)+"-"+Math.floor(Math.random()*900+100);
   const {data,error}=await access.supabase.from("gmp_cash_vouchers").insert({organization_id:access.organization.id,branch_id:uuid(txt(b.branch_id,80))?txt(b.branch_id,80):null,voucher_no:no,voucher_type:type,party_type:partyType,customer_id:partyType==="customer"&&uuid(customerId)?customerId:null,supplier_id:partyType==="supplier"&&uuid(supplierId)?supplierId:null,amount,payment_method:txt(b.payment_method,20)||"cash",reference:txt(b.reference,150)||null,notes:txt(b.notes,1000)||null,voucher_date:txt(b.voucher_date,20)||new Date().toISOString().slice(0,10),status:"posted",created_by:access.user.id}).select("*").single();
   if(error)return json({error:error.message},400);return json({success:true,row:data},201);
  }
  if(action==="quote_status"){
   const quoteId=txt(b.quote_id,80),status=txt(b.status,20);
   if(!uuid(quoteId)||!["sent","accepted","rejected","expired","cancelled"].includes(status))return json({error:"invalid_quote_transition"},400);
   const {data:quote,error}=await access.supabase.from("gmp_sales_quotes").select("id,status,valid_until").eq("id",quoteId).eq("organization_id",access.organization.id).single();
   if(error||!quote)return json({error:"quote_not_found"},404);
   const allowed:Record<string,string[]>={draft:["sent","cancelled"],sent:["accepted","rejected","expired","cancelled"],accepted:["rejected","cancelled"]};
   if(!(allowed[quote.status]||[]).includes(status))return json({error:"invalid_quote_transition"},409);
   const {data:updated,error:updateError}=await access.supabase.from("gmp_sales_quotes").update({status,updated_at:new Date().toISOString()}).eq("id",quoteId).eq("organization_id",access.organization.id).select("*").single();
   if(updateError)return json({error:updateError.message},400);
   return json({success:true,row:updated});
  }
  if(action==="quote_convert"){
   const quoteId=txt(b.quote_id,80);if(!uuid(quoteId))return json({error:"quote_required"},400);
   const {data:quote,error:quoteError}=await access.supabase.from("gmp_sales_quotes").select("*").eq("id",quoteId).eq("organization_id",access.organization.id).single();
   if(quoteError||!quote)return json({error:"quote_not_found"},404);
   if(quote.status!=="accepted")return json({error:"quote_must_be_accepted"},409);
   const {data:existing}=await access.supabase.from("gmp_sales").select("id,invoice_no").eq("organization_id",access.organization.id).eq("notes","quote:"+quoteId).maybeSingle();
   if(existing)return json({success:true,already_converted:true,sale:existing});
   const {data:lines,error:lineError}=await access.supabase.from("gmp_sales_quote_lines").select("product_id,quantity,weight_grams,unit_price,making_charge,discount_amount,vat_amount").eq("quote_id",quoteId);
   if(lineError||!lines?.length||lines.some((l:any)=>!l.product_id))return json({error:"quote_lines_not_convertible"},409);
   const productIds=[...new Set(lines.map((l:any)=>l.product_id).filter(Boolean))] as string[];const {data:ownedProducts}=await access.supabase.from("gmp_products").select("id").eq("organization_id",access.organization.id).in("id",productIds);if((ownedProducts??[]).length!==productIds.length)return json({error:"quote_product_not_found"},409);
   const {data:sale,error:saleError}=await access.supabase.rpc("gmp_create_and_post_sale",{p_organization_id:access.organization.id,p_branch_id:quote.branch_id,p_store_id:quote.store_id,p_customer_id:quote.customer_id,p_payment_method:txt(b.payment_method,20)||"cash",p_notes:"quote:"+quoteId,p_lines:lines});
   if(saleError)return json({error:saleError.message},400);
   const {data:updated,error:updateError}=await access.supabase.from("gmp_sales_quotes").update({status:"converted",updated_at:new Date().toISOString()}).eq("id",quoteId).eq("organization_id",access.organization.id).eq("status","accepted").select("*").single();
   if(updateError)return json({error:updateError.message},400);
   return json({success:true,converted:true,sale,quote:updated});
  }
  if(action==="price_item"){
   const priceListId=txt(b.price_list_id,80),productId=txt(b.product_id,80);
   if(!uuid(priceListId)||!uuid(productId))return json({error:"price_item_ids_required"},400);
   const {data:list}=await access.supabase.from("gmp_price_lists").select("id").eq("id",priceListId).eq("organization_id",access.organization.id).maybeSingle();
   if(!list)return json({error:"price_list_not_found"},404);
   if(!(await belongsToOrg(access,"gmp_products",productId)))return json({error:"product_not_found"},404);
   const {data:item,error}=await access.supabase.from("gmp_price_list_items").upsert({price_list_id:priceListId,product_id:productId,sell_price:num(b.sell_price)||null,buy_price:num(b.buy_price)||null,making_charge:num(b.making_charge),min_quantity:b.min_quantity===null||b.min_quantity===undefined?null:num(b.min_quantity),max_quantity:b.max_quantity===null||b.max_quantity===undefined?null:num(b.max_quantity)},{onConflict:"price_list_id,product_id"}).select("*").single();
   if(error)return json({error:error.message},400);return json({success:true,row:item});
  }
  if(action==="price_list"){
   const name=txt(b.name,150);if(!name)return json({error:"name_required"},400);
   const storeId=txt(b.store_id,80);if(storeId&&!(await belongsToOrg(access,"gmp_stores",storeId)))return json({error:"store_not_found"},404);
   const {data:list,error}=await access.supabase.from("gmp_price_lists").insert({organization_id:access.organization.id,store_id:uuid(storeId)?storeId:null,name,currency:txt(b.currency,8)||"OMR",active:b.active!==false,valid_from:txt(b.valid_from,20)||null,valid_until:txt(b.valid_until,20)||null}).select("*").single();
   if(error)return json({error:error.message},400);return json({success:true,row:list},201);
  }
  return json({error:"unsupported_action"},400);
 }catch(e){return json({error:e instanceof Error?e.message:"unexpected_error"},500)}
}