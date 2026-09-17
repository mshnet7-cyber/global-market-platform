import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { requireStage2Permission, type Stage2Permission } from "../../../lib/stage2-access";
import { recordAuditEvent } from "../../../lib/provider-observability";

const json = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: { "cache-control": "no-store" },
});

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
function positive(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function hash(value: string) { return crypto.createHash("sha256").update(value).digest("hex"); }

async function body(request: Request) {
  return asObject(await request.json().catch(() => null));
}

async function orgStore(supabase: any, organizationId: string, storeId: string) {
  const { data } = await supabase.from("gmp_stores").select("id,organization_id,branch_id,name,slug,country_code,currency,timezone,phone,whatsapp,logo_path")
    .eq("id", storeId).eq("organization_id", organizationId).maybeSingle();
  return data ?? null;
}

async function orgBranch(supabase: any, organizationId: string, branchId: string) {
  const { data } = await supabase.from("gmp_branches").select("id,name,code,city,address,phone,whatsapp,active")
    .eq("id", branchId).eq("organization_id", organizationId).maybeSingle();
  return data ?? null;
}

async function auditStage2(access:any, action:string, entityType:string, entityId:string|null, metadata?:Record<string,unknown>) { void recordAuditEvent({ action, organizationId:access.organization?.id, userId:access.user?.id, entityType, entityId, metadata }); }

async function requirePermission(permission: Stage2Permission, plans: ("starter"|"pro"|"business")[] = ["starter","pro","business"]) {
  return requireStage2Permission(permission, plans);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "directory";
  try {

    if (action === "marketplace") {
      const admin = createSupabaseAdminClient();
      if (!admin) return json({ error: "not_configured" }, 503);
      const { data: directory } = await admin.from("gmp_store_directory")
        .select("store_id,status,description,category,city,services,hours")
        .eq("status","published").limit(200);
      const storeIds = (directory ?? []).map((x:any)=>x.store_id);
      if (!storeIds.length) return json({ stores: [], listings: [] });
      const [{ data: stores }, { data: listings, error }] = await Promise.all([
        admin.from("gmp_stores").select("id,name,slug,phone,whatsapp,logo_path,country_code,currency,timezone").in("id",storeIds),
        admin.from("gmp_marketplace_listings").select("id,store_id,listing_type,title,description,category,price,currency,availability,contact_mode,image_path,metadata,updated_at").in("store_id",storeIds).eq("status","active").order("updated_at",{ascending:false}).limit(500)
      ]);
      if(error) return json({error:error.message},400);
      const dirMap=new Map((directory??[]).map((d:any)=>[d.store_id,d]));
      const storeMap=new Map((stores??[]).map((s:any)=>[s.id,s]));
      return json({
        stores:(stores??[]).map((s:any)=>({store:s,directory:dirMap.get(s.id)??null})),
        listings:(listings??[]).map((l:any)=>({...l,store:storeMap.get(l.store_id)??null}))
      });
    }

    if (action === "directory") {
      const admin = createSupabaseAdminClient();
      if (!admin) return json({ error: "not_configured" }, 503);
      const q = text(url.searchParams.get("q"), 80).toLowerCase();
      const city = text(url.searchParams.get("city"), 80).toLowerCase();
      const category = text(url.searchParams.get("category"), 80).toLowerCase();
      const { data: rows, error } = await admin.from("gmp_store_directory")
        .select("store_id,status,description,category,address,city,region,website,services,hours,social_links,verified_at,published_at,updated_at")
        .eq("status", "published").order("published_at", { ascending: false }).limit(100);
      if (error) return json({ error: error.message }, 400);
      const ids = (rows ?? []).map(r => r.store_id);
      const { data: stores } = ids.length ? await admin.from("gmp_stores").select("id,organization_id,name,slug,phone,whatsapp,logo_path,country_code,currency,timezone").in("id", ids) : { data: [] as any[] };
      const storeMap = new Map((stores ?? []).map(s => [s.id, s]));
      const data = (rows ?? []).map(r => ({ ...r, store: storeMap.get(r.store_id) ?? null })).filter(r => {
        const hay = JSON.stringify(r).toLowerCase();
        return (!q || hay.includes(q)) && (!city || String(r.city ?? "").toLowerCase().includes(city)) &&
          (!category || String(r.category ?? "").toLowerCase().includes(category));
      });
      return json({ rows: data });
    }

    if (action === "store") {
      const admin = createSupabaseAdminClient();
      if (!admin) return json({ error: "not_configured" }, 503);
      const slug = text(url.searchParams.get("slug"), 100);
      const { data: stores } = await admin.from("gmp_stores").select("id,organization_id,name,slug,phone,whatsapp,logo_path,country_code,currency,timezone")
        .eq("slug", slug).limit(1);
      const store = stores?.[0];
      if (!store) return json({ error: "store_not_found" }, 404);
      const { data: directory } = await admin.from("gmp_store_directory").select("*").eq("store_id", store.id).eq("status","published").maybeSingle();
      if (!directory) return json({ error: "store_not_published" }, 404);
      const { data: listings } = await admin.from("gmp_marketplace_listings")
        .select("id,listing_type,title,description,category,price,currency,availability,contact_mode,image_path,metadata,updated_at")
        .eq("store_id", store.id).eq("status","active").order("updated_at",{ascending:false}).limit(200);
      const { data: branches } = await admin.from("gmp_branches").select("id,name,code,city,address,phone,whatsapp,active")
        .eq("organization_id", store.organization_id).eq("active",true).order("name").limit(50);
      return json({ store, directory, listings: listings ?? [], branches: branches ?? [] });
    }

    if (action === "listings") {
      const admin = createSupabaseAdminClient();
      if (!admin) return json({ error: "not_configured" }, 503);
      const storeId = text(url.searchParams.get("store_id"), 80);
      const slug = text(url.searchParams.get("slug"), 100);
      let target = storeId;
      if (!target && slug) {
        const { data: s } = await admin.from("gmp_stores").select("id").eq("slug",slug).maybeSingle();
        target = s?.id ?? "";
      }
      if (!isUuid(target)) return json({ error: "store_required" }, 400);
      const { data: directory } = await admin.from("gmp_store_directory").select("store_id,status").eq("store_id",target).eq("status","published").maybeSingle();
      if (!directory) return json({ error: "store_not_published" }, 404);
      const { data, error } = await admin.from("gmp_marketplace_listings")
        .select("id,listing_type,title,description,category,price,currency,availability,contact_mode,image_path,metadata,updated_at")
        .eq("store_id",target).eq("status","active").order("updated_at",{ascending:false}).limit(200);
      if (error) return json({ error: error.message },400);
      return json({ rows:data ?? [] });
    }

    if (action === "erp") {
      const access = await requirePermission("erp.read");
      const storeIds = (await access.supabase.from("gmp_stores").select("id").eq("organization_id", access.organization.id)).data?.map((x:any)=>x.id) ?? [];
      const [stores,branches,products,customers,suppliers,sales,purchases,expenses,repairs,goldPurchases,accounts,journals,members] = await Promise.all([
        access.supabase.from("gmp_stores").select("id,name,slug,branch_id,country_code,currency,timezone").eq("organization_id",access.organization.id).order("created_at"),
        access.supabase.from("gmp_branches").select("id,name,code,city,address,phone,whatsapp,active").eq("organization_id",access.organization.id).order("name"),
        storeIds.length ? access.supabase.from("gmp_products").select("id,store_id,name,sku,barcode,category,karat,weight_grams,making_charge,price,cost_price,current_quantity,current_weight_grams,active").in("store_id",storeIds).order("updated_at",{ascending:false}).limit(500) : {data:[],error:null},
        access.supabase.from("gmp_customers").select("id,branch_id,name,phone,language,country_code,notes,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(300),
        access.supabase.from("gmp_suppliers").select("id,name,phone,whatsapp,language,tax_number,notes,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(300),
        access.supabase.from("gmp_sales").select("id,store_id,branch_id,customer_id,invoice_no,status,subtotal,discount_amount,vat_amount,total,payment_method,issued_at,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(150),
        access.supabase.from("gmp_purchases").select("id,store_id,branch_id,supplier_id,invoice_no,status,subtotal,vat_amount,total,purchase_date,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(150),
        access.supabase.from("gmp_expenses").select("id,branch_id,category,description,amount,vat_amount,expense_date,status,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(150),
        access.supabase.from("gmp_repair_orders").select("id,branch_id,customer_id,repair_no,item_description,metal,karat,weight_received_grams,weight_delivered_grams,repair_type,status,amount,expected_delivery_at,received_at,ready_at,delivered_at,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(150),
        access.supabase.from("gmp_person_gold_purchases").select("id,branch_id,transaction_no,seller_name,seller_phone,karat,weight_grams,market_reference_price,purchase_price,payment_method,status,risk_level,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(150),
        access.supabase.from("gmp_accounts").select("id,code,name,account_type,system_key,active").eq("organization_id",access.organization.id).order("code"),
        access.supabase.from("gmp_journal_entries").select("id,branch_id,reference_type,reference_id,entry_no,description,entry_date,status,created_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(150),
        access.supabase.from("gmp_organization_members").select("organization_id,user_id,role,created_at").eq("organization_id",access.organization.id).order("created_at")
      ]);
      const { data: marketplaceListings } = await access.supabase.from("gmp_marketplace_listings")
        .select("id,store_id,product_id,listing_type,title,description,category,price,currency,availability,contact_mode,status,updated_at")
        .eq("organization_id",access.organization.id).order("updated_at",{ascending:false}).limit(300);
      const { data: marketplaceOrders } = await access.supabase.from("gmp_marketplace_orders")
        .select("id,order_no,store_id,buyer_name,buyer_phone,buyer_email,note,status,fulfillment_mode,subtotal,currency,created_at,updated_at")
        .eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(200);
      return json({ role:access.role, planCode:access.planCode, stores:stores.data??[], branches:branches.data??[], products:products.data??[],
        customers:customers.data??[], suppliers:suppliers.data??[], sales:sales.data??[], purchases:purchases.data??[],
        expenses:expenses.data??[], repairs:repairs.data??[], goldPurchases:goldPurchases.data??[], accounts:accounts.data??[],
        journals:journals.data??[], members:members.data??[], marketplaceListings:marketplaceListings??[], marketplaceOrders:marketplaceOrders??[] });
    }

    if (action === "team") {
      const access = await requirePermission("staff.read");
      const { data: members } = await access.supabase.from("gmp_organization_members").select("user_id,role,created_at").eq("organization_id",access.organization.id).order("created_at");
      const ids = (members??[]).map((m:any)=>m.user_id);
      const { data: profiles } = ids.length ? await access.supabase.from("gmp_profiles").select("id,display_name,locale,role").in("id",ids) : {data:[] as any[]};
      const { data: perms } = ids.length ? await access.supabase.from("gmp_member_permissions").select("user_id,permissions,updated_at").eq("organization_id",access.organization.id).in("user_id",ids) : {data:[] as any[]};
      return json({members:members??[],profiles:profiles??[],permissions:perms??[],currentUserId:access.user.id,role:access.role});
    }

    if (action === "displays") {
      const access = await requirePermission("displays.read");
      const [stores,screens,content,schedules] = await Promise.all([
        access.supabase.from("gmp_stores").select("id,name,slug").eq("organization_id",access.organization.id).order("name"),
        access.supabase.from("gmp_screens").select("id,store_id,name,status,template,last_seen_at,last_snapshot_at").order("created_at"),
        access.supabase.from("gmp_display_content").select("id,store_id,screen_id,content_type,title,body,media_path,payload,active,priority,created_at,updated_at").eq("organization_id",access.organization.id).order("priority",{ascending:false}),
        access.supabase.from("gmp_display_schedules").select("id,store_id,screen_id,content_id,starts_at,ends_at,days_of_week,enabled").eq("organization_id",access.organization.id).order("starts_at")
      ]);
      return json({stores:stores.data??[],screens:screens.data??[],content:content.data??[],schedules:schedules.data??[]});
    }

    if (action === "dooh") {
      const access = await requirePermission("dooh.read");
      const [campaigns,creatives,placements,screens,stores] = await Promise.all([
        access.supabase.from("gmp_ad_campaigns").select("id,store_id,organization_id,advertiser_name,advertiser_phone,advertiser_email,title,body,image_path,target_url,country_code,city,placement,status,starts_at,ends_at,impressions,clicks,budget,created_at,updated_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(200),
        access.supabase.from("gmp_ad_creatives").select("id,campaign_id,name,creative_type,asset_path,target_url,status,metadata,created_at,updated_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(300),
        access.supabase.from("gmp_ad_placements").select("id,campaign_id,creative_id,screen_id,store_id,status,starts_at,ends_at,weight,created_at,updated_at").eq("organization_id",access.organization.id).order("created_at",{ascending:false}).limit(300),
        access.supabase.from("gmp_screens").select("id,store_id,name,status,template,last_seen_at,last_snapshot_at").order("created_at"),
        access.supabase.from("gmp_stores").select("id,name,slug").eq("organization_id",access.organization.id).order("name")
      ]);
      return json({campaigns:campaigns.data??[],creatives:creatives.data??[],placements:placements.data??[],screens:screens.data??[],stores:stores.data??[]});
    }

    return json({error:"unsupported_action"},400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return json({ error: message }, message === "stage2_forbidden" ? 403 : 500);
  }
}

export async function POST(request: Request) {
  const b = await body(request);
  const action = text(b.action, 80);
  try {
    if (action === "marketplace_order") {
      const admin = createSupabaseAdminClient();
      if (!admin) return json({error:"not_configured"},503);
      const storeId = text(b.store_id,80);
      if (!isUuid(storeId)) return json({error:"store_required"},400);
      const lines = Array.isArray(b.lines) ? b.lines : [];
      const result = await admin.rpc("gmp_create_marketplace_order",{
        p_store_id:storeId,p_buyer_name:text(b.buyer_name,120),p_buyer_phone:text(b.buyer_phone,40),
        p_buyer_email:text(b.buyer_email,160) || null,p_note:text(b.note,1000) || null,
        p_lines:lines,p_fulfillment_mode:text(b.fulfillment_mode,20) || "contact",
        p_idempotency_key:text(b.idempotency_key,120) || hash(JSON.stringify({storeId,buyer:text(b.buyer_phone,40),lines}))
      });
      if (result.error) return json({error:result.error.message},400);
      return json(result.data,201);
    }

    if (action === "directory") {
      const access = await requirePermission("directory.write");
      const storeId = text(b.store_id,80);
      const store = await orgStore(access.supabase,access.organization.id,storeId);
      if (!store) return json({error:"store_not_found"},404);
      const status = ["draft","published","suspended"].includes(text(b.status,20)) ? text(b.status,20) : "draft";
      const row = {
        store_id:storeId,status,description:text(b.description,2000)||null,category:text(b.category,100)||null,
        address:text(b.address,300)||null,city:text(b.city,100)||null,region:text(b.region,100)||null,postal_code:text(b.postal_code,30)||null,
        latitude:b.latitude === "" || b.latitude == null ? null : Number(b.latitude),longitude:b.longitude === "" || b.longitude == null ? null : Number(b.longitude),
        website:text(b.website,300)||null,services:Array.isArray(b.services)?b.services.slice(0,50):[],
        hours:asObject(b.hours),social_links:asObject(b.social_links),
        verified_at: b.verified_at ? new Date(String(b.verified_at)).toISOString() : null,
        published_at: status==="published" ? new Date().toISOString() : null,updated_by:access.user.id
      };
      if ((row.latitude != null && !Number.isFinite(row.latitude)) || (row.longitude != null && !Number.isFinite(row.longitude))) return json({error:"invalid_coordinates"},400);
      const {data,error}=await access.supabase.from("gmp_store_directory").upsert(row,{onConflict:"store_id"}).select("*").single();
      if(error)return json({error:error.message},400);
      void auditStage2(access,"merchant.directory.upsert","store_directory",storeId,{status});
      return json({success:true,row},201);
    }

    if (action === "listing") {
      const access = await requirePermission("marketplace.write");
      const storeId = text(b.store_id,80), id=text(b.id,80);
      const store=await orgStore(access.supabase,access.organization.id,storeId);
      if(!store)return json({error:"store_not_found"},404);
      if(b.product_id){
        const {data:p}=await access.supabase.from("gmp_products").select("id,store_id").eq("id",String(b.product_id)).eq("store_id",storeId).maybeSingle();
        if(!p)return json({error:"product_not_found"},404);
      }
      const payload={
        organization_id:access.organization.id,store_id:storeId,product_id:b.product_id?String(b.product_id):null,
        listing_type:b.listing_type==="service"?"service":"product",title:text(b.title,180),description:text(b.description,2000)||null,
        category:text(b.category,100)||null,price:positive(b.price),currency:store.currency,
        availability:["in_stock","limited","out_of_stock","on_request"].includes(text(b.availability,30))?text(b.availability,30):"in_stock",
        contact_mode:b.contact_mode==="request"?"request":"contact",status:["draft","active","paused","archived"].includes(text(b.status,30))?text(b.status,30):"draft",
        image_path:text(b.image_path,500)||null,metadata:asObject(b.metadata),created_by:access.user.id
      };
      if(!payload.title)return json({error:"title_required"},400);
      const query=id && isUuid(id) ? access.supabase.from("gmp_marketplace_listings").update(payload).eq("id",id).eq("organization_id",access.organization.id) :
        access.supabase.from("gmp_marketplace_listings").insert(payload);
      const {data,error}=await query.select("*").single();
      if(error)return json({error:error.message},400);
      void auditStage2(access,"merchant.marketplace.listing.upsert","marketplace_listing",data?.id ?? null,{store_id:storeId,status:payload.status});
      return json({success:true,row:data},201);
    }


    if (action === "branch") {
      const access = await requirePermission("erp.write",["pro","business"]);
      const name = text(b.name,150);
      if (!name) return json({error:"branch_name_required"},400);
      const {data,error}=await access.supabase.from("gmp_branches").insert({
        organization_id:access.organization.id,name,code:text(b.code,40)||null,city:text(b.city,100)||null,
        address:text(b.address,300)||null,phone:text(b.phone,60)||null,whatsapp:text(b.whatsapp,60)||null,active:b.active!==false
      }).select("*").single();
      if(error)return json({error:error.message},400);
      void auditStage2(access,"merchant.branch.create","branch",data?.id ?? null);
      return json({success:true,row:data},201);
    }

    if (action === "customer") {
      const access = await requirePermission("erp.write",["pro","business"]);
      const branchId=text(b.branch_id,80);
      if(branchId && !await orgBranch(access.supabase,access.organization.id,branchId))return json({error:"branch_not_found"},404);
      const {data,error}=await access.supabase.from("gmp_customers").insert({
        organization_id:access.organization.id,branch_id:branchId||null,name:text(b.name,150),phone:text(b.phone,60)||null,
        phone_normalized:text(b.phone_normalized,60)||null,language:text(b.language,10)||"ar",country_code:text(b.country_code,3).toUpperCase()||null,notes:text(b.notes,1000)||null
      }).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.customer.create","customer",data?.id ?? null); return json({success:true,row:data},201);
    }

    if (action === "supplier") {
      const access = await requirePermission("erp.write",["pro","business"]);
      const {data,error}=await access.supabase.from("gmp_suppliers").insert({
        organization_id:access.organization.id,name:text(b.name,150),phone:text(b.phone,60)||null,whatsapp:text(b.whatsapp,60)||null,
        language:text(b.language,10)||"ar",tax_number:text(b.tax_number,100)||null,notes:text(b.notes,1000)||null
      }).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.supplier.create","supplier",data?.id ?? null); return json({success:true,row:data},201);
    }

    if (action === "product") {
      const access = await requirePermission("inventory.write",["pro","business"]);
      const storeId=text(b.store_id,80); if(!await orgStore(access.supabase,access.organization.id,storeId))return json({error:"store_not_found"},404);
      const {data,error}=await access.supabase.rpc("gmp_create_inventory_product",{
        p_organization_id:access.organization.id,p_store_id:storeId,p_name:text(b.name,180),p_sku:text(b.sku,80),
        p_barcode:text(b.barcode,80),p_category:text(b.category,100),p_karat:text(b.karat,20),p_price:positive(b.price),
        p_cost_price:positive(b.cost_price),p_making_charge:positive(b.making_charge),
        p_initial_quantity:positive(b.initial_quantity),p_initial_weight:positive(b.initial_weight)
      });
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.inventory.product.create","product",data?.product_id ?? null); return json(data,201);
    }

    if (action === "sale") {
      const access = await requirePermission("pos.write",["pro","business"]);
      const lines=Array.isArray(b.lines)?b.lines:[]; if(!lines.length)return json({error:"lines_required"},400);
      const {data,error}=await access.supabase.rpc("gmp_create_and_post_sale",{
        p_organization_id:access.organization.id,p_branch_id:isUuid(text(b.branch_id,80))?text(b.branch_id,80):null,
        p_store_id:text(b.store_id,80),p_customer_id:isUuid(text(b.customer_id,80))?text(b.customer_id,80):null,
        p_payment_method:text(b.payment_method,20)||"cash",p_notes:text(b.notes,1500)||null,p_lines:lines
      });
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.pos.sale.post","sale",data?.sale_id ?? null,{invoice_no:data?.invoice_no}); return json(data,201);
    }

    if (action === "purchase") {
      const access = await requirePermission("erp.write",["pro","business"]);
      const {data,error}=await access.supabase.rpc("gmp_create_purchase",{
        p_organization_id:access.organization.id,p_branch_id:isUuid(text(b.branch_id,80))?text(b.branch_id,80):null,
        p_store_id:text(b.store_id,80),p_supplier_id:isUuid(text(b.supplier_id,80))?text(b.supplier_id,80):null,
        p_invoice_no:text(b.invoice_no,100),p_lines:Array.isArray(b.lines)?b.lines:[]
      });
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.purchase.create","purchase",data?.purchase_id ?? null); return json(data,201);
    }

    if (action === "expense") {
      const access = await requirePermission("erp.write",["business"]);
      const {data,error}=await access.supabase.rpc("gmp_create_and_post_expense",{
        p_organization_id:access.organization.id,p_branch_id:isUuid(text(b.branch_id,80))?text(b.branch_id,80):null,
        p_category:text(b.category,120),p_description:text(b.description,1000),p_amount:positive(b.amount),
        p_vat_amount:positive(b.vat_amount),p_expense_date:text(b.expense_date,20)||new Date().toISOString().slice(0,10),
        p_expense_account_id:text(b.expense_account_id,80),p_payment_account_id:text(b.payment_account_id,80)
      });
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.expense.post","expense",data?.expense_id ?? null); return json(data,201);
    }

    if (action === "journal") {
      const access = await requirePermission("erp.write",["business"]);
      const {data,error}=await access.supabase.rpc("gmp_create_manual_journal",{
        p_organization_id:access.organization.id,p_branch_id:isUuid(text(b.branch_id,80))?text(b.branch_id,80):null,
        p_description:text(b.description,500),p_entry_date:text(b.entry_date,20)||new Date().toISOString().slice(0,10),
        p_lines:Array.isArray(b.lines)?b.lines:[]
      });
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.journal.post","journal_entry",data?.entry_id ?? null); return json(data,201);
    }

    if (action === "repair") {
      const access=await requirePermission("erp.write",["pro","business"]);
      const id=text(b.id,80); const status=text(b.status,30)||"received";
      const allowed=["received","in_repair","ready","delivered","cancelled"];
      if(!allowed.includes(status))return json({error:"invalid_repair_status"},400);
      const base={branch_id:isUuid(text(b.branch_id,80))?text(b.branch_id,80):null,customer_id:isUuid(text(b.customer_id,80))?text(b.customer_id,80):null,
        item_description:text(b.item_description,500),metal:text(b.metal,30)||null,karat:text(b.karat,20)||null,
        weight_received_grams:positive(b.weight_received_grams),weight_delivered_grams:b.weight_delivered_grams==null?null:positive(b.weight_delivered_grams),
        damage_description:text(b.damage_description,1200)||null,repair_type:text(b.repair_type,100)||null,status,
        expected_days:b.expected_days==null?null:Math.max(0,Math.floor(Number(b.expected_days))),
        expected_delivery_at:b.expected_delivery_at?new Date(String(b.expected_delivery_at)).toISOString():null,
        amount:positive(b.amount),before_photo_path:text(b.before_photo_path,500)||null,after_photo_path:text(b.after_photo_path,500)||null,notes:text(b.notes,1500)||null,
        delivered_by:isUuid(text(b.delivered_by,80))?text(b.delivered_by,80):null
      };
      if(!base.item_description || base.weight_received_grams<=0)return json({error:"repair_item_and_weight_required"},400);
      if(id && isUuid(id)){
        const {data,error}=await access.supabase.from("gmp_repair_orders").update(base).eq("id",id).eq("organization_id",access.organization.id).select("*").single();
        if(error)return json({error:error.message},400); void auditStage2(access,"merchant.repair.update","repair_order",data?.id ?? null,{status}); return json({success:true,row:data});
      }
      const {data,error}=await access.supabase.from("gmp_repair_orders").insert({...base,organization_id:access.organization.id,created_by:access.user.id}).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.repair.create","repair_order",data?.id ?? null,{status}); return json({success:true,row:data},201);
    }

    if (action === "gold_purchase") {
      const access=await requirePermission("erp.write",["business"]);
      const branchId=text(b.branch_id,80); if(branchId && !await orgBranch(access.supabase,access.organization.id,branchId))return json({error:"branch_not_found"},404);
      const weight=positive(b.weight_grams), price=positive(b.purchase_price);
      if(!text(b.seller_name,150) || !text(b.seller_phone,60) || !text(b.identity_document_path,500) || weight<=0 || price<=0)return json({error:"gold_purchase_required_fields"},400);
      const risk=["normal","high"].includes(text(b.risk_level,20))?text(b.risk_level,20):"normal";
      const {data,error}=await access.supabase.from("gmp_person_gold_purchases").insert({
        organization_id:access.organization.id,branch_id:branchId||null,seller_name:text(b.seller_name,150),seller_phone:text(b.seller_phone,60),
        seller_phone_normalized:text(b.seller_phone_normalized,60)||null,seller_language:text(b.seller_language,10)||"ar",
        identity_document_path:text(b.identity_document_path,500),identity_document_hash:text(b.identity_document_hash,128)||null,
        item_description:text(b.item_description,500)||null,karat:text(b.karat,20)||null,weight_grams:weight,
        market_reference_price:positive(b.market_reference_price),purchase_price:price,payment_method:text(b.payment_method,30)||"cash",
        status:"pending_review",risk_level:risk,risk_reasons:Array.isArray(b.risk_reasons)?b.risk_reasons.slice(0,20):[],
        ai_extracted_data:{},ai_confidence:null,created_by:access.user.id
      }).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.gold_purchase.create","gold_purchase",data?.id ?? null,{risk_level:risk}); return json({success:true,row:data},201);
    }

    if (action === "permission") {
      const access=await requirePermission("staff.write",["business"]);
      const userId=text(b.user_id,80); if(!isUuid(userId))return json({error:"user_id_required"},400);
      const {data:member}=await access.supabase.from("gmp_organization_members").select("user_id").eq("organization_id",access.organization.id).eq("user_id",userId).maybeSingle();
      if(!member)return json({error:"member_not_found"},404);
      const input=asObject(b.permissions); const safe:Record<string,boolean>={};
      const allowed=["directory.read","directory.write","marketplace.read","marketplace.write","erp.read","erp.write","pos.write","inventory.write","staff.read","staff.write","displays.read","displays.write","dooh.read","dooh.write"];
      for(const key of allowed) if(typeof input[key]==="boolean") safe[key]=input[key] as boolean;
      const {data,error}=await access.supabase.from("gmp_member_permissions").upsert({organization_id:access.organization.id,user_id:userId,permissions:safe,created_by:access.user.id},{onConflict:"organization_id,user_id"}).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"merchant.permission.update","member_permission",userId,{permissions:safe}); return json({success:true,row:data});
    }

    if (action === "display_content") {
      const access=await requirePermission("displays.write");
      const storeId=text(b.store_id,80), screenId=text(b.screen_id,80);
      if(!await orgStore(access.supabase,access.organization.id,storeId))return json({error:"store_not_found"},404);
      const payload={organization_id:access.organization.id,store_id:storeId,screen_id:isUuid(screenId)?screenId:null,
        content_type:["text","market","gold","ad","listing"].includes(text(b.content_type,20))?text(b.content_type,20):"text",
        title:text(b.title,180),body:text(b.body,2000)||null,media_path:text(b.media_path,500)||null,payload:asObject(b.payload),
        active:b.active!==false,priority:Math.max(-1000,Math.min(1000,Math.floor(Number(b.priority)||0))),created_by:access.user.id};
      if(!payload.title)return json({error:"title_required"},400);
      const {data,error}=await access.supabase.from("gmp_display_content").insert(payload).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"display.content.create","display_content",data?.id ?? null,{screen_id:screenId}); return json({success:true,row:data},201);
    }

    if (action === "display_schedule") {
      const access=await requirePermission("displays.write");
      const storeId=text(b.store_id,80),screenId=text(b.screen_id,80),contentId=text(b.content_id,80);
      if(!await orgStore(access.supabase,access.organization.id,storeId)||!isUuid(screenId)||!isUuid(contentId))return json({error:"display_scope_required"},400);
      const {data:screen}=await access.supabase.from("gmp_screens").select("id,store_id").eq("id",screenId).eq("store_id",storeId).maybeSingle();
      const {data:content}=await access.supabase.from("gmp_display_content").select("id,store_id").eq("id",contentId).eq("store_id",storeId).eq("organization_id",access.organization.id).maybeSingle();
      if(!screen||!content)return json({error:"display_reference_invalid"},400);
      const days=Array.isArray(b.days_of_week)?b.days_of_week.map(Number).filter((n:number)=>Number.isInteger(n)&&n>=0&&n<=6):[];
      const {data,error}=await access.supabase.from("gmp_display_schedules").insert({organization_id:access.organization.id,store_id:storeId,screen_id:screenId,content_id:contentId,
        starts_at:b.starts_at?new Date(String(b.starts_at)).toISOString():null,ends_at:b.ends_at?new Date(String(b.ends_at)).toISOString():null,days_of_week:days,enabled:b.enabled!==false,created_by:access.user.id}).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"display.schedule.create","display_schedule",data?.id ?? null,{screen_id:screenId}); return json({success:true,row:data},201);
    }

    if (action === "dooh_campaign") {
      const access=await requirePermission("dooh.write");
      const {data,error}=await access.supabase.from("gmp_ad_campaigns").insert({
        organization_id:access.organization.id,store_id:isUuid(text(b.store_id,80))?text(b.store_id,80):null,
        advertiser_name:text(b.advertiser_name,180),advertiser_phone:text(b.advertiser_phone,60)||null,advertiser_email:text(b.advertiser_email,160)||null,
        title:text(b.title,180),body:text(b.body,2000)||null,image_path:text(b.image_path,500)||null,target_url:text(b.target_url,500)||null,whatsapp:text(b.whatsapp,60)||null,
        country_code:text(b.country_code,3).toUpperCase()||null,city:text(b.city,100)||null,placement:text(b.placement,30)||"screen",
        status:"pending",starts_at:b.starts_at?new Date(String(b.starts_at)).toISOString():null,ends_at:b.ends_at?new Date(String(b.ends_at)).toISOString():null,
        budget:b.budget==null?null:positive(b.budget),created_by:access.user.id
      }).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"dooh.campaign.create","ad_campaign",data?.id ?? null); return json({success:true,row:data},201);
    }

    if (action === "dooh_creative") {
      const access=await requirePermission("dooh.write");
      const campaignId=text(b.campaign_id,80);
      const {data:c}=await access.supabase.from("gmp_ad_campaigns").select("id,organization_id").eq("id",campaignId).eq("organization_id",access.organization.id).maybeSingle();
      if(!c)return json({error:"campaign_not_found"},404);
      const {data,error}=await access.supabase.from("gmp_ad_creatives").insert({organization_id:access.organization.id,campaign_id:campaignId,name:text(b.name,180),
        creative_type:["image","video","html","text","url"].includes(text(b.creative_type,20))?text(b.creative_type,20):"image",
        asset_path:text(b.asset_path,500)||null,target_url:text(b.target_url,500)||null,metadata:asObject(b.metadata),status:"draft",created_by:access.user.id}).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"dooh.creative.create","ad_creative",data?.id ?? null); return json({success:true,row:data},201);
    }

    if (action === "dooh_placement") {
      const access=await requirePermission("dooh.write");
      const campaignId=text(b.campaign_id,80),creativeId=text(b.creative_id,80),screenId=text(b.screen_id,80),storeId=text(b.store_id,80);
      const {data:c}=await access.supabase.from("gmp_ad_campaigns").select("id").eq("id",campaignId).eq("organization_id",access.organization.id).maybeSingle();
      if(!c)return json({error:"campaign_not_found"},404);
      if(!isUuid(screenId)&&!isUuid(storeId))return json({error:"placement_scope_required"},400);
      if(isUuid(storeId)&&!await orgStore(access.supabase,access.organization.id,storeId))return json({error:"store_not_found"},404);
      if(isUuid(screenId)){
        const {data:s}=await access.supabase.from("gmp_screens").select("id,store_id").eq("id",screenId).maybeSingle();
        if(!s)return json({error:"screen_not_found"},404);
      }
      if(creativeId){const {data:cr}=await access.supabase.from("gmp_ad_creatives").select("id").eq("id",creativeId).eq("campaign_id",campaignId).eq("organization_id",access.organization.id).maybeSingle();if(!cr)return json({error:"creative_not_found"},404);}
      const status=["scheduled","live","paused","completed","cancelled"].includes(text(b.status,20))?text(b.status,20):"scheduled";
      const {data,error}=await access.supabase.from("gmp_ad_placements").insert({organization_id:access.organization.id,campaign_id:campaignId,creative_id:creativeId||null,screen_id:isUuid(screenId)?screenId:null,store_id:isUuid(storeId)?storeId:null,status,
        starts_at:b.starts_at?new Date(String(b.starts_at)).toISOString():null,ends_at:b.ends_at?new Date(String(b.ends_at)).toISOString():null,weight:Math.max(1,Math.min(100,Math.floor(Number(b.weight)||1))),created_by:access.user.id}).select("*").single();
      if(error)return json({error:error.message},400); void auditStage2(access,"dooh.placement.create","ad_placement",data?.id ?? null); return json({success:true,row:data},201);
    }

    if (action === "status") {
      const entity=text(b.entity,40), id=text(b.id,80), status=text(b.status,40);
      if(!isUuid(id))return json({error:"id_required"},400);
      const access=await requirePermission(entity==="marketplace_order"?"marketplace.write":entity==="dooh_campaign"||entity==="dooh_placement"?"dooh.write":entity==="display_content"?"displays.write":"erp.write");
      const map:any={
        marketplace_order:{table:"gmp_marketplace_orders",statuses:["new","contacted","confirmed","fulfilled","cancelled"]},
        dooh_campaign:{table:"gmp_ad_campaigns",statuses:["pending","approved","active","paused","completed","cancelled"]},
        dooh_placement:{table:"gmp_ad_placements",statuses:["scheduled","live","paused","completed","cancelled"]},
        display_content:{table:"gmp_display_content",statuses:[]},
        repair:{table:"gmp_repair_orders",statuses:["received","in_repair","ready","delivered","cancelled"]},
      };
      const cfg=map[entity]; if(!cfg || (cfg.statuses.length && !cfg.statuses.includes(status)))return json({error:"invalid_status"},400);
      const query=access.supabase.from(cfg.table).update({status,updated_at:new Date().toISOString()}).eq("id",id);
      if(entity==="dooh_campaign" || entity==="dooh_placement")query.eq("organization_id",access.organization.id);
      if(entity==="marketplace_order")query.eq("organization_id",access.organization.id);
      if(entity==="repair")query.eq("organization_id",access.organization.id);
      const {data,error}=await query.select("*").single();
      if(error)return json({error:error.message},400);return json({success:true,row:data});
    }

    return json({error:"unsupported_action"},400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    return json({error:message}, message === "stage2_forbidden" ? 403 : 500);
  }
}
