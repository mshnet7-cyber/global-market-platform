"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Data = {
  role: string; planCode: string; stores: any[]; branches: any[]; products: any[]; customers: any[]; suppliers: any[];
  sales: any[]; purchases: any[]; expenses: any[]; repairs: any[]; goldPurchases: any[]; accounts: any[]; journals: any[]; members: any[]; marketplaceListings: any[]; marketplaceOrders: any[];
};
const tabs = [
  ["overview","نظرة عامة"],["pos","نقطة البيع"],["inventory","المخزون"],["purchases","المشتريات"],["branches","الفروع"],["contacts","العملاء والموردون"],
  ["repairs","الإصلاحات"],["buy-gold","شراء الذهب"],["finance","المالية"],["directory","دليل المحلات"],["marketplace","السوق"],["staff","الموظفون"],
  ["displays","الشاشات"],["dooh","الإعلانات الرقمية"]
] as const;
const money=(v:any)=>v==null||!Number.isFinite(Number(v))?"—":Number(v).toLocaleString("en-OM",{minimumFractionDigits:3,maximumFractionDigits:3});
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const ROLE_LABELS:Record<string,string>={owner:"مالك",admin:"مدير",viewer:"مشاهد"};
const STATUS_LABELS:Record<string,string>={draft:"مسودة",published:"منشور",suspended:"موقوف",new:"جديد",contacted:"تم التواصل",confirmed:"مؤكد",fulfilled:"مكتمل",cancelled:"ملغى",failed:"فشل",queued:"في الطابور",sending:"جارٍ الإرسال",submitted:"تم الإرسال",accepted:"مقبولة",rejected:"مرفوضة",active:"مفعّل",inactive:"غير مفعّل",LIVE:"مباشر",planned:"مخطط",ready:"جاهز",configured:"مُهيأ",disabled:"معطل"};
const AVAILABILITY_LABELS:Record<string,string>={in_stock:"متوفر",out_of_stock:"غير متوفر",backorder:"طلب مسبق"};
function displayValue(column:string,value:any){
  if(value==null)return "—";
  if(column==="status")return STATUS_LABELS[String(value)]??String(value);
  if(column==="availability")return AVAILABILITY_LABELS[String(value)]??String(value);
  if(column==="active" || column.endsWith("_enabled"))return value===true||value==="true"?"نعم":value===false||value==="false"?"لا":String(value);
  if(column==="risk_level")return ({normal:"عادي",medium:"متوسط",high:"مرتفع",low:"منخفض"} as Record<string,string>)[String(value)]??String(value);
  return String(value);
}

export default function OperationsPage(){
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") || "overview";
  const initialTab=tabs.some(([key])=>key===requestedTab)?requestedTab:"overview";
  const [tab,setTab]=useState(initialTab),[data,setData]=useState<Data|null>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const [displayData,setDisplayData]=useState<any>(null),[team,setTeam]=useState<any>(null),[dooh,setDooh]=useState<any>(null),[directory,setDirectory]=useState<any[]>([]);
  const [storeId,setStoreId]=useState(""),[productId,setProductId]=useState(""),[qty,setQty]=useState("1"),[weight,setWeight]=useState("0"),[price,setPrice]=useState("0"),[payment,setPayment]=useState("cash");
  const get=useCallback(async(url:string)=>{const r=await fetch(url,{cache:"no-store"});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error||"request_failed");return d;},[]);
  const post=useCallback(async(payload:any)=>{const r=await fetch("/api/stage2",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});const d=await r.json().catch(()=>null);if(!r.ok)throw new Error(d?.error||"request_failed");return d;},[]);
  const load=useCallback(async()=>{
    setLoading(true);setMessage("");
    try{const d=await get("/api/stage2?action=erp");setData(d);setStoreId(function(v){return v||d.stores?.[0]?.id||""});setProductId(function(v){return v||d.products?.[0]?.id||""});if(d.products?.[0])setPrice(String(d.products[0].price||0));}
    catch(e){setMessage(e instanceof Error?e.message:"تعذر تحميل مركز التشغيل");}
    finally{setLoading(false);}
  },[get]);
  const aux=useCallback(async()=>{
    try{
      if(tab==="staff")setTeam(await get("/api/stage2?action=team"));
      if(tab==="displays")setDisplayData(await get("/api/stage2?action=displays"));
      if(tab==="dooh")setDooh(await get("/api/stage2?action=dooh"));
      if(tab==="directory")setDirectory((await get("/api/stage2?action=directory")).rows||[]);
    }catch(e){setMessage(e instanceof Error?e.message:"تعذر تحميل الوحدة");}
  },[get,tab]);
  useEffect(()=>{const id=window.setTimeout(()=>{void load();},0);return()=>window.clearTimeout(id);},[load]);
  useEffect(()=>{const id=window.setTimeout(()=>{void aux();},0);return()=>window.clearTimeout(id);},[aux]);
  const product=useMemo(()=>data?.products?.find(p=>p.id===productId),[data,productId]);
  async function act(payload:any){setBusy(true);setMessage("");try{await post(payload);setMessage("تم حفظ العملية");await load();await aux();}catch(e){setMessage(e instanceof Error?e.message:"حدث خطأ");}finally{setBusy(false);}}
  if(loading)return <main className="stage2-page"><div className="stage2-empty">جارٍ تحميل مركز التشغيل…</div></main>;
  if(!data)return <main className="stage2-page"><div className="stage2-empty"><h1>مركز تشغيل التاجر</h1><p>{message||"يلزم تسجيل الدخول وخطة نشطة."}</p><Link href="/login?next=/dashboard/operations" className="btn btn-primary">تسجيل الدخول</Link></div></main>;

  const submitField=(id:string)=>{const el=document.getElementById(id) as HTMLInputElement|null;return el?.value||""};

  return <main className="stage2-page">
    <header className="stage2-page-head">
      <div><div className="eyebrow">تشغيل التاجر المتقدم</div><h1>مركز تشغيل التاجر</h1><p>المبيعات والمخزون والسوق والشاشات والإعلانات الرقمية في مساحة عمل واحدة، مع صلاحيات على مستوى المؤسسة.</p></div>
      <div className="stage2-head-actions"><Link href="/directory" className="btn">دليل المحلات</Link><Link href="/marketplace" className="btn">السوق</Link></div>
    </header>
    <nav className="stage2-tabs" role="tablist" aria-label="أقسام مركز تشغيل التاجر">{tabs.map(function(x){const selected=tab===x[0];return <button key={x[0]} id={"stage2-tab-"+x[0]} type="button" role="tab" aria-selected={selected} aria-controls={"stage2-panel-"+x[0]} tabIndex={selected?0:-1} className={selected?"active":""} onClick={()=>setTab(x[0])}>{x[1]}</button>})}</nav>
    {message&&<div className="stage2-alert">{message}</div>}

    {tab==="overview"&&<section id="stage2-panel-overview" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-overview">
      <div className="stage2-kpis">
        <div><span>المتاجر</span><strong>{data.stores.length}</strong><small>{data.branches.length} فرع</small></div>
        <div><span>المخزون</span><strong>{data.products.length}</strong><small>{money(data.products.reduce((s,p)=>s+num(p.current_weight_grams),0))} غ</small></div>
        <div><span>المبيعات</span><strong>{data.sales.length}</strong><small>{money(data.sales.slice(0,30).reduce((s,p)=>s+num(p.total),0))}</small></div>
        <div><span>الذهب المشترى</span><strong>{data.goldPurchases.length}</strong><small>{money(data.goldPurchases.slice(0,30).reduce((s,p)=>s+num(p.weight_grams),0))} غ</small></div>
      </div>
      <div className="stage2-grid two">
        <article className="stage2-panel"><div className="stage2-panel-head"><h2>تكامل المرحلة الأولى</h2><span className="stage2-badge">{data.planCode==="business"?"الكاملة":data.planCode==="pro"?"الأعمال":data.planCode||"غير محددة"}</span></div><p>التسعير المرجعي بقي في lib/gold-pricing.ts، والسوق في طبقة Stage 1. البيع هنا يستدعي مسار الترحيل الذري الموجود.</p><div className="stage2-mini-list"><div>نقطة البيع ← المخزون ← تكلفة المبيعات ← القيد</div><div>شراء الذهب ← الهوية / المخاطر / المراجعة</div><div>الإصلاحات ← دورة القطعة ← أساس سجل التدقيق</div><div>السوق ← تواصل / طلب، دون دفع إلكتروني</div></div></article>
        <article className="stage2-panel"><h2>المتاجر</h2>{data.stores.map(s=><div className="stage2-row" key={s.id}><div><strong>{s.name}</strong><small>{s.country_code} · {s.currency}</small></div><span>{s.timezone}</span></div>)}</article>
      </div>
    </section>}

    {tab==="pos"&&<section id="stage2-panel-pos" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-pos">
      <div className="stage2-section-title"><div><div className="eyebrow">نقطة البيع</div><h2>بيع سريع</h2><p>المسار الحالي يعتمد على gmp_create_and_post_sale.</p></div></div>
      <div className="stage2-form-grid">
        <label>المحل<select value={storeId} onChange={e=>setStoreId(e.target.value)}>{data.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>الصنف<select value={productId} onChange={e=>{setProductId(e.target.value);const p=data.products.find(x=>x.id===e.target.value);setPrice(String(p?.price||0));}}>{data.products.map(p=><option key={p.id} value={p.id}>{p.name} {p.karat||""}</option>)}</select></label>
        <label>الكمية<input value={qty} onChange={e=>setQty(e.target.value)} inputMode="decimal"/></label><label>الوزن<input value={weight} onChange={e=>setWeight(e.target.value)} inputMode="decimal"/></label>
        <label>سعر الوحدة<input value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal"/></label>
        <label>الدفع<select value={payment} onChange={e=>setPayment(e.target.value)}><option value="cash">نقدًا</option><option value="bank">بنكي</option><option value="card">بطاقة</option><option value="wallet">محفظة</option><option value="other">أخرى</option></select></label>
      </div>
      <div className="stage2-callout">المتاح: {money(product?.current_quantity)} وحدة · {money(product?.current_weight_grams)} غ</div>
      <button className="btn btn-primary" disabled={busy||!storeId||!productId} onClick={()=>void act({action:"sale",store_id:storeId,branch_id:data.stores.find(s=>s.id===storeId)?.branch_id,payment_method:payment,lines:[{product_id:productId,quantity:num(qty),weight_grams:num(weight),unit_price:num(price),making_charge:num(product?.making_charge),discount_amount:0,vat_amount:0}]})}>اعتماد البيع</button>
      <Table rows={data.sales.slice(0,30)} columns={["invoice_no","status","total","created_at"]} labels={["الفاتورة","الحالة","الإجمالي","التاريخ"]}/>
    </section>}

    {tab==="inventory"&&<section id="stage2-panel-inventory" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-inventory">
      <div className="stage2-form-grid">
        <label>المحل<select id="i-store">{data.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>اسم الصنف<input id="i-name" required/></label><label>SKU<input id="i-sku"/></label><label>الباركود<input id="i-barcode"/></label><label>العيار<input id="i-karat" defaultValue="21K"/></label><label>الفئة<input id="i-cat"/></label><label>السعر<input id="i-price" inputMode="decimal"/></label><label>التكلفة<input id="i-cost" inputMode="decimal"/></label><label>المصنعية<input id="i-making" inputMode="decimal"/></label><label>كمية افتتاحية<input id="i-qty" defaultValue="0" inputMode="decimal"/></label><label>وزن افتتاحي<input id="i-weight" defaultValue="0" inputMode="decimal"/></label>
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={()=>void act({action:"product",store_id:submitField("i-store"),name:submitField("i-name"),sku:submitField("i-sku"),barcode:submitField("i-barcode"),karat:submitField("i-karat"),category:submitField("i-cat"),price:num(submitField("i-price")),cost_price:num(submitField("i-cost")),making_charge:num(submitField("i-making")),initial_quantity:num(submitField("i-qty")),initial_weight:num(submitField("i-weight"))})}>إضافة صنف</button>
      <Table rows={data.products.slice(0,100)} columns={["sku","name","karat","current_quantity","current_weight_grams","cost_price","price"]} labels={["SKU","الصنف","العيار","الكمية","الوزن","التكلفة","السعر"]}/>
    </section>}

    {tab==="purchases"&&<section id="stage2-panel-purchases" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-purchases">
      <div className="stage2-form-grid"><label>المحل<select id="p-store">{data.stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>المورد<select id="p-supplier"><option value="">غير محدد</option>{data.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>فاتورة المورد<input id="p-invoice"/></label><label>الوصف<input id="p-desc"/></label><label>الكمية<input id="p-qty" defaultValue="1" inputMode="decimal"/></label><label>الوزن<input id="p-weight" defaultValue="0" inputMode="decimal"/></label><label>تكلفة الوحدة<input id="p-cost" defaultValue="0" inputMode="decimal"/></label><label>المصنعية<input id="p-making" defaultValue="0" inputMode="decimal"/></label><label>VAT<input id="p-vat" defaultValue="0" inputMode="decimal"/></label></div>
      <button className="btn btn-primary" disabled={busy} onClick={()=>void act({action:"purchase",store_id:submitField("p-store"),supplier_id:submitField("p-supplier"),invoice_no:submitField("p-invoice"),lines:[{raw_description:submitField("p-desc"),quantity:num(submitField("p-qty")),weight_grams:num(submitField("p-weight")),unit_cost:num(submitField("p-cost")),making_charge:num(submitField("p-making")),vat_amount:num(submitField("p-vat"))}]})}>حفظ الشراء</button>
      <Table rows={data.purchases.slice(0,80)} columns={["invoice_no","status","total","purchase_date"]} labels={["الفاتورة","الحالة","الإجمالي","التاريخ"]}/>
    </section>}

    {tab==="branches"&&<section id="stage2-panel-branches" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-branches">
      <SimpleForm title="فرع جديد" fields={["name","code","city","address","phone","whatsapp"]} submit={async f=>act({action:"branch",name:f.name,code:f.code,city:f.city,address:f.address,phone:f.phone,whatsapp:f.whatsapp})}/>
      <Table rows={data.branches.slice(0,100)} columns={["code","name","city","phone","active"]} labels={["الرمز","الفرع","المدينة","الهاتف","الحالة"]}/>
    </section>}

    {tab==="contacts"&&<section id="stage2-panel-contacts" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-contacts">
      <div className="stage2-grid two">
        <SimpleForm title="عميل جديد" fields={["name","phone","notes"]} submit={async f=>act({action:"customer",name:f.name,phone:f.phone,notes:f.notes})}/>
        <SimpleForm title="مورد جديد" fields={["name","phone","whatsapp","tax_number","notes"]} submit={async f=>act({action:"supplier",name:f.name,phone:f.phone,whatsapp:f.whatsapp,tax_number:f.tax_number,notes:f.notes})}/>
      </div>
      <Table rows={data.customers.slice(0,60)} columns={["name","phone","created_at"]} labels={["العميل","الهاتف","التاريخ"]}/>
      <Table rows={data.suppliers.slice(0,60)} columns={["name","phone","tax_number","created_at"]} labels={["المورد","الهاتف","الضريبة","التاريخ"]}/>
    </section>}

    {tab==="repairs"&&<section id="stage2-panel-repairs" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-repairs">
      <SimpleForm title="استلام إصلاح" fields={["item_description","metal","karat","weight_received_grams","repair_type","amount","notes"]} submit={async f=>act({action:"repair",item_description:f.item_description,metal:f.metal,karat:f.karat,weight_received_grams:num(f.weight_received_grams),repair_type:f.repair_type,amount:num(f.amount),notes:f.notes})}/>
      <Table rows={data.repairs.slice(0,80)} columns={["repair_no","item_description","weight_received_grams","status","amount"]} labels={["#","القطعة","الوزن","الحالة","المبلغ"]}/>
    </section>}

    {tab==="buy-gold"&&<section id="stage2-panel-buy-gold" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-buy-gold">
      <SimpleForm title="شراء الذهب من الأفراد" fields={["seller_name","seller_phone","identity_document_path","item_description","karat","weight_grams","market_reference_price","purchase_price","payment_method","risk_level"]} submit={async f=>act({action:"gold_purchase",seller_name:f.seller_name,seller_phone:f.seller_phone,identity_document_path:f.identity_document_path,item_description:f.item_description,karat:f.karat,weight_grams:num(f.weight_grams),market_reference_price:num(f.market_reference_price),purchase_price:num(f.purchase_price),payment_method:f.payment_method||"cash",risk_level:f.risk_level||"normal"})}/>
      <Table rows={data.goldPurchases.slice(0,80)} columns={["transaction_no","seller_name","weight_grams","karat","purchase_price","risk_level"]} labels={["#","البائع","الوزن","العيار","السعر","المخاطر"]}/>
    </section>}

    {tab==="finance"&&<section id="stage2-panel-finance" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-finance">
      <SimpleForm title="مصروف جديد" fields={["category","description","amount","vat_amount","expense_account_id","payment_account_id"]} submit={async f=>act({action:"expense",category:f.category,description:f.description,amount:num(f.amount),vat_amount:num(f.vat_amount),expense_account_id:f.expense_account_id,payment_account_id:f.payment_account_id})}/>
      <Table rows={data.journals.slice(0,80)} columns={["entry_no","reference_type","description","status","entry_date"]} labels={["القيد","المرجع","الوصف","الحالة","التاريخ"]}/>
    </section>}

    {tab==="directory"&&<section id="stage2-panel-directory" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-directory">
      <div className="stage2-grid two">{data.stores.map(s=>{const d=directory.find(x=>x.store_id===s.id)||{};return <article className="stage2-panel" key={s.id}><h2>{s.name}</h2><label>الحالة<select id={"dir-status-"+s.id} defaultValue={d.status||"draft"}><option value="draft">مسودة</option><option value="published">منشور</option><option value="suspended">موقوف</option></select></label><label>الفئة<input id={"dir-cat-"+s.id} defaultValue={d.category||""}/></label><label>الوصف<textarea id={"dir-desc-"+s.id} defaultValue={d.description||""}/></label><label>العنوان<input id={"dir-address-"+s.id} defaultValue={d.address||""}/></label><label>المدينة<input id={"dir-city-"+s.id} defaultValue={d.city||""}/></label><label>المنطقة<input id={"dir-region-"+s.id} defaultValue={d.region||""}/></label><label>الخدمات<input id={"dir-services-"+s.id} defaultValue={Array.isArray(d.services)?d.services.join(", "):""}/></label><button className="btn btn-primary" onClick={()=>void act({action:"directory",store_id:s.id,status:submitField("dir-status-"+s.id),category:submitField("dir-cat-"+s.id),description:submitField("dir-desc-"+s.id),address:submitField("dir-address-"+s.id),city:submitField("dir-city-"+s.id),region:submitField("dir-region-"+s.id),services:submitField("dir-services-"+s.id).split(",").map(x=>x.trim()).filter(Boolean)})}>حفظ الملف</button></article>})}</div>
    </section>}

    {tab==="marketplace"&&<section id="stage2-panel-marketplace" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-marketplace">
      <SimpleForm title="عرض جديد في السوق" fields={["store_id","product_id","title","description","category","price","availability","status"]} submit={async f=>act({action:"listing",store_id:f.store_id,product_id:f.product_id||null,title:f.title,description:f.description,category:f.category,price:num(f.price),availability:f.availability||"in_stock",status:f.status||"draft"})}/>
      <Table rows={data.marketplaceListings.slice(0,100)} columns={["title","store_id","price","availability","status","updated_at"]} labels={["العرض","المتجر","السعر","التوفر","الحالة","التحديث"]}/>
      <div className="stage2-table-wrap"><table><thead><tr><th>الطلب</th><th>المشتري</th><th>الإجمالي</th><th>الحالة</th><th>التغيير</th></tr></thead><tbody>{data.marketplaceOrders.slice(0,100).map((o:any)=><tr key={o.id}><td>#{o.order_no}</td><td>{o.buyer_name}<br/><small>{o.buyer_phone}</small></td><td>{money(o.subtotal)} {o.currency}</td><td>{STATUS_LABELS[o.status] ?? o.status}</td><td><select value={o.status} onChange={e=>void act({action:"status",entity:"marketplace_order",id:o.id,status:e.target.value})}><option value="new">جديد</option><option value="contacted">تم التواصل</option><option value="confirmed">مؤكد</option><option value="fulfilled">مكتمل</option><option value="cancelled">ملغى</option></select></td></tr>)}</tbody></table></div>
    </section>}

    {tab==="staff"&&<section id="stage2-panel-staff" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-staff"><div className="stage2-grid two">{(team?.members||[]).map((m:any)=>{const p=(team?.profiles||[]).find((x:any)=>x.id===m.user_id);const perms=(team?.permissions||[]).find((x:any)=>x.user_id===m.user_id)?.permissions||{};return <article className="stage2-panel" key={m.user_id}><div className="stage2-panel-head"><h2>{p?.display_name||m.user_id.slice(0,8)}</h2><span className="stage2-badge">{m.role}</span></div><div className="permission-grid">{["directory.write","marketplace.write","erp.write","pos.write","inventory.write","staff.write","displays.write","dooh.write"].map(k=><label key={k}><input type="checkbox" id={"perm-"+m.user_id+"-"+k} defaultChecked={perms[k]!==undefined?perms[k]:m.role!=="viewer"}/>{PERMISSION_LABELS[k] ?? k}</label>)}</div><button className="btn btn-primary" onClick={()=>{const o:Record<string,boolean>={};["directory.write","marketplace.write","erp.write","pos.write","inventory.write","staff.write","displays.write","dooh.write"].forEach(k=>{const el=document.getElementById("perm-"+m.user_id+"-"+k) as HTMLInputElement|null;o[k]=Boolean(el?.checked)});void act({action:"permission",user_id:m.user_id,permissions:o})}}>حفظ</button></article>})}</div></section>}

    {tab==="displays"&&<section id="stage2-panel-displays" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-displays">
      <div className="stage2-grid two">{(displayData?.screens||[]).map((s:any)=><article className="stage2-panel" key={s.id}><div className="stage2-panel-head"><h2>{s.name}</h2><span className="stage2-badge">{STATUS_LABELS[s.status] ?? s.status}</span></div><p>{displayData?.stores?.find((x:any)=>x.id===s.store_id)?.name}</p><small>آخر ظهور: {s.last_seen_at?new Date(s.last_seen_at).toLocaleString("ar-OM"):"—"} · آخر لقطة: {s.last_snapshot_at?new Date(s.last_snapshot_at).toLocaleString("ar-OM"):"—"}</small></article>)}</div>
      <SimpleForm title="محتوى الشاشة" fields={["store_id","screen_id","content_type","title","body","priority"]} submit={async f=>act({action:"display_content",store_id:f.store_id,screen_id:f.screen_id,content_type:f.content_type||"text",title:f.title,body:f.body,priority:num(f.priority)})}/>
      <Table rows={displayData?.content||[]} columns={["title","content_type","active","priority"]} labels={["العنوان","النوع","نشط","الأولوية"]}/>
    </section>}

    {tab==="dooh"&&<section id="stage2-panel-dooh" className="stage2-section" role="tabpanel" aria-labelledby="stage2-tab-dooh">
      <div className="stage2-kpis"><div><span>الحملات</span><strong>{dooh?.campaigns?.length||0}</strong></div><div><span>المواد الإعلانية</span><strong>{dooh?.creatives?.length||0}</strong></div><div><span>مواضع العرض</span><strong>{dooh?.placements?.length||0}</strong></div><div><span>مباشر</span><strong>{(dooh?.placements||[]).filter((x:any)=>x.status==="live").length}</strong></div></div>
      <div className="stage2-grid three">
        <SimpleForm title="حملة إعلانية" fields={["advertiser_name","title","body","country_code","city"]} submit={async f=>act({action:"dooh_campaign",advertiser_name:f.advertiser_name,title:f.title,body:f.body,country_code:f.country_code,city:f.city})}/>
        <SimpleForm title="مادة إعلانية" fields={["campaign_id","name","creative_type","asset_path","target_url"]} submit={async f=>act({action:"dooh_creative",campaign_id:f.campaign_id,name:f.name,creative_type:f.creative_type||"image",asset_path:f.asset_path,target_url:f.target_url})}/>
        <SimpleForm title="موضع عرض" fields={["campaign_id","creative_id","screen_id","store_id","weight"]} submit={async f=>act({action:"dooh_placement",campaign_id:f.campaign_id,creative_id:f.creative_id,screen_id:f.screen_id,store_id:f.store_id,weight:num(f.weight)||1})}/>
      </div>
      <Table rows={dooh?.campaigns||[]} columns={["title","advertiser_name","status","impressions","clicks"]} labels={["الحملة","المعلن","الحالة","مرات الظهور","النقرات"]}/>
    </section>}
  </main>;
}

function Table({rows,columns,labels}:{rows:any[];columns:string[];labels:string[]}){
  return <div className="stage2-table-wrap"><table><thead><tr>{labels.map(l=><th key={l}>{l}</th>)}</tr></thead><tbody>{rows.map((r:any,i:number)=><tr key={r.id||i}>{columns.map(c=><td key={c}>{c.endsWith("_at")&&r[c]?new Date(r[c]).toLocaleString("ar-OM"):displayValue(c,r[c])}</td>)}</tr>)}</tbody></table></div>;
}
const PERMISSION_LABELS: Record<string,string> = {"directory.write":"تعديل دليل المحلات","marketplace.write":"إدارة السوق","erp.write":"إدارة التشغيل","pos.write":"نقطة البيع","inventory.write":"إدارة المخزون","staff.write":"إدارة الموظفين","displays.write":"إدارة الشاشات","dooh.write":"الإعلانات الرقمية"};
const FIELD_LABELS: Record<string,string> = {
  name:"الاسم", code:"الرمز", city:"المدينة", address:"العنوان", phone:"الهاتف", whatsapp:"واتساب", notes:"ملاحظات",
  item_description:"وصف القطعة", metal:"المعدن", karat:"العيار", weight_received_grams:"الوزن المستلم (غ)", repair_type:"نوع الإصلاح",
  amount:"المبلغ", seller_name:"اسم البائع", seller_phone:"هاتف البائع", identity_document_path:"مرجع وثيقة الهوية",
  weight_grams:"الوزن (غ)", market_reference_price:"سعر السوق المرجعي", purchase_price:"سعر الشراء", payment_method:"طريقة الدفع",
  category:"الفئة", description:"الوصف", vat_amount:"ضريبة القيمة المضافة", expense_account_id:"حساب المصروف", payment_account_id:"حساب الدفع",
  store_id:"المتجر", product_id:"الصنف", title:"العنوان", price:"السعر", availability:"التوفر", status:"الحالة",
  campaign_id:"الحملة", creative_id:"المادة الإعلانية", creative_type:"نوع المادة", asset_path:"مسار الملف", target_url:"الرابط",
  advertiser_name:"اسم المعلن", country_code:"رمز الدولة", screen_id:"الشاشة", content_type:"نوع المحتوى", body:"النص",
  priority:"الأولوية", weight:"الوزن", supplier_id:"المورد", invoice_no:"رقم الفاتورة", raw_description:"وصف الصنف",
  quantity:"الكمية", unit_cost:"تكلفة الوحدة", making_charge:"المصنعية", risk_level:"مستوى المخاطر",
};

function SimpleForm({title,fields,submit}:{title:string;fields:string[];submit:(f:any)=>Promise<void>|void}){
  const requiredFields = new Set(["name","title","advertiser_name","seller_name","seller_phone","identity_document_path","item_description","weight_received_grams","purchase_price","category","amount"]);
  return <form className="stage2-panel" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const o:any={};fields.forEach(k=>o[k]=String(f.get(k)||""));void submit(o)}}>
    <h2>{title}</h2>
    {fields.map(k=><label key={k}>{FIELD_LABELS[k] ?? k}<input name={k} required={requiredFields.has(k)} /></label>)}
    <button className="btn btn-primary" type="submit">حفظ</button>
  </form>;
}
