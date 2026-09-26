"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Doc=any;
type DraftLine = {
  raw_description:string; sku:string; barcode:string; karat:string;
  quantity:string; weight_grams:string; unit_cost:string; making_charge:string; vat_amount:string;
};
type PurchaseDraft = {
  document:Doc; stores:any[]; suppliers:any[]; storeId:string; supplierId:string;
  supplierName:string; invoiceNo:string; lines:DraftLine[];
};
const emptyDraftLine=():DraftLine=>({raw_description:"",sku:"",barcode:"",karat:"",quantity:"1",weight_grams:"0",unit_cost:"0",making_charge:"0",vat_amount:"0"});
function invoiceSources(value:any):Record<string,any>[] {
  const root=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
  const nested=[root.fields,root.invoice,root.extracted_data,root.data,root.result]
    .filter(x=>x&&typeof x==="object"&&!Array.isArray(x));
  return [...nested,root];
}
function invoiceValue(sources:Record<string,any>[],keys:string[]):string {
  for(const source of sources)for(const key of keys){
    const value=source[key];
    if(value!==undefined&&value!==null&&String(value).trim())return String(value).trim();
  }
  return "";
}
function extractedPurchaseLines(value:any):DraftLine[] {
  const sources=invoiceSources(value);
  const keys=["line_items","items","lines","products","purchase_lines","details"];
  let rows:any[]=[];
  for(const source of sources){for(const key of keys){if(Array.isArray(source[key])){rows=source[key];break;}}if(rows.length)break;}
  return rows.slice(0,100).map((row:any)=>{
    const item=row&&typeof row==="object"&&!Array.isArray(row)?row:{description:row};
    const read=(names:string[])=>invoiceValue([item],names);
    return {
      raw_description:read(["raw_description","description","product_name","name","item","details"]),
      sku:read(["sku","item_code","product_code"]),
      barcode:read(["barcode","bar_code","ean","upc"]),
      karat:read(["karat","purity","fineness"]),
      quantity:read(["quantity","qty","pieces"])||"1",
      weight_grams:read(["weight_grams","net_weight_grams","weight","net_weight","grams"])||"0",
      unit_cost:read(["unit_cost","unit_price","price","cost"])||"0",
      making_charge:read(["making_charge","making","labor","workmanship"])||"0",
      vat_amount:read(["vat_amount","vat","tax"])||"0",
    };
  });
}


export default function DocumentsPage(){
  const [docs,setDocs]=useState<Doc[]>([]);
  const [integration,setIntegration]=useState<any>(null);
  const [file,setFile]=useState<File|null>(null);
  const [type,setType]=useState("supplier_invoice");
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState("");
  const [message,setMessage]=useState("");
  const [purchaseDraft,setPurchaseDraft]=useState<PurchaseDraft|null>(null);

  const load=useCallback(async()=>{
    const r=await fetch("/api/merchant/documents",{cache:"no-store"});
    const d=await r.json();
    if(r.ok){setDocs(d.documents??[]);setIntegration(d.integration)}else setMessage(d.error??"تعذر تحميل المستندات");
  },[]);
  useEffect(()=>{void load()},[load]);

  async function upload(){
    if(!file)return setMessage("اختر مستندًا أولًا");
    setBusy(true);setMessage("");setProgress("1/4 رفع المستند إلى التخزين الآمن…");
    try{
      const fd=new FormData();fd.set("action","upload");fd.set("file",file);fd.set("document_type",type);
      const r=await fetch("/api/merchant/documents",{method:"POST",body:fd});const d=await r.json();
      if(!r.ok)throw new Error(d.error??"تعذر حفظ المستند");
      setProgress("2/4 تم إنشاء سجل المستند. بدء OCR…");
      const o=new FormData();o.set("action","ocr");o.set("document_id",d.document.id);
      const or=await fetch("/api/merchant/documents",{method:"POST",body:o});const od=await or.json();
      if(!or.ok){
        setProgress("2/4 تم الرفع، لكن OCR غير متاح حاليًا.");
        setMessage(od.integration_state==="integration_ready"?"المستند محفوظ بأمان. أضف بيانات اعتماد مزود الذكاء الاصطناعي لتشغيل OCR.":od.error??"تعذر تشغيل OCR");
      }else{
        setProgress("3/4 اكتمل OCR. النتيجة بانتظار المراجعة.");
        setMessage("تم استخراج البيانات. راجع النتيجة ثم وافق أو ارفض.");
      }
      setFile(null);const input=document.getElementById("doc-file") as HTMLInputElement|null;if(input)input.value="";
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"تعذر رفع المستند");setProgress("فشل المسار — يمكنك إعادة المحاولة.");}
    finally{setBusy(false)}
  }


  async function openPurchaseDraft(doc:Doc){
    setBusy(true);setMessage("");
    try{
      if(doc.document_type!=="supplier_invoice"||doc.review_status!=="approved")throw new Error("اعتمد فاتورة المورد قبل تحويلها إلى مسودة شراء.");
      const r=await fetch("/api/stage2?action=purchase_context",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error??"تعذر تحميل بيانات المؤسسة");
      const sources=invoiceSources(doc.ai_extracted_data);
      const supplierName=invoiceValue(sources,["supplier_name","vendor_name","supplier","vendor","seller_name"]);
      const invoiceNo=invoiceValue(sources,["invoice_no","invoice_number","document_number","reference"]);
      const lines=extractedPurchaseLines(doc.ai_extracted_data);
      const matchedSupplier=(d.suppliers??[]).find((s:any)=>String(s.name??"").trim().toLocaleLowerCase()===supplierName.toLocaleLowerCase());
      setPurchaseDraft({document:doc,stores:d.stores??[],suppliers:d.suppliers??[],storeId:d.stores?.[0]?.id??"",supplierId:matchedSupplier?.id??"",supplierName,invoiceNo,lines:lines.length?lines:[emptyDraftLine()]});
    }catch(e){setMessage(e instanceof Error?e.message:"تعذر إعداد مسودة الشراء");}
    finally{setBusy(false);}
  }
  function updateDraftLine(index:number,key:keyof DraftLine,value:string){
    setPurchaseDraft(current=>current?{...current,lines:current.lines.map((line,i)=>i===index?{...line,[key]:value}:line)}:current);
  }
  async function createPurchaseDraft(){
    if(!purchaseDraft)return;
    if(!purchaseDraft.storeId){setMessage("اختر المحل أو الفرع أولًا.");return;}
    const valid=purchaseDraft.lines.length>0&&purchaseDraft.lines.every(line=>line.raw_description.trim()&&Number.isFinite(Number(line.quantity))&&Number(line.quantity)>0&&Number.isFinite(Number(line.weight_grams))&&Number(line.weight_grams)>=0&&Number.isFinite(Number(line.unit_cost))&&Number(line.unit_cost)>=0&&Number.isFinite(Number(line.making_charge))&&Number(line.making_charge)>=0&&Number.isFinite(Number(line.vat_amount))&&Number(line.vat_amount)>=0);
    if(!valid){setMessage("راجع وصف كل صنف والكمية والوزن والتكلفة والضريبة؛ جميع القيم يجب أن تكون أرقامًا غير سالبة.");return;}
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/stage2",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        action:"purchase_from_document",source_document_id:purchaseDraft.document.id,store_id:purchaseDraft.storeId,
        supplier_id:purchaseDraft.supplierId,invoice_no:purchaseDraft.invoiceNo,
        lines:purchaseDraft.lines.map(line=>({...line,quantity:Number(line.quantity),weight_grams:Number(line.weight_grams),unit_cost:Number(line.unit_cost),making_charge:Number(line.making_charge),vat_amount:Number(line.vat_amount)}))
      })});
      const result=await r.json().catch(()=>null);
      if(!r.ok)throw new Error(result?.error??"تعذر إنشاء مسودة المشتريات");
      setPurchaseDraft(null);
      setMessage(result.already_linked?"هذه الفاتورة مرتبطة بمسودة شراء سابقة.":"تم إنشاء مسودة شراء من الفاتورة المعتمدة. لم تتم إضافة أي كمية إلى المخزون.");
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"تعذر إنشاء مسودة الشراء");}
    finally{setBusy(false);}
  }

  async function action(documentId:string,action:"ocr"|"review",status?:string){
    setBusy(true);setMessage("");
    try{
      const fd=new FormData();fd.set("action",action);fd.set("document_id",documentId);if(status)fd.set("status",status);
      setProgress(action==="ocr"?"إعادة تشغيل OCR…":"حفظ قرار المراجعة…");
      const r=await fetch("/api/merchant/documents",{method:"POST",body:fd});const d=await r.json();
      if(!r.ok)throw new Error(d.error??"تعذر تنفيذ العملية");
      setMessage(action==="ocr"?"تم تحديث نتيجة OCR.":"تم حفظ قرار المراجعة.");
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:"تعذر تنفيذ العملية")}
    finally{setBusy(false)}
  }

  return <div className="dashboard-shell" dir="rtl" lang="ar">
    <header className="topbar"><div className="container nav site-nav"><Link href="/dashboard" className="brand"><img src="/brand/arcanetic-gold.png" alt="ARCANETIC Gold" style={{height:38,width:"auto",maxWidth:200,objectFit:"contain"}}/><span style={{display:"grid",lineHeight:1.1}}><b>ARCANETIC Gold</b><small style={{fontSize:10,opacity:.7}}>GLOBAL MARKET</small></span></Link><nav className="nav-links" aria-label="تنقل لوحة المحل"><Link href="/dashboard">الرئيسية</Link><Link href="/dashboard/sales">المبيعات</Link><Link href="/dashboard/inventory">المخزون</Link><Link href="/dashboard/reports">التقارير</Link><Link href="/dashboard/integrations">التكاملات</Link></nav><div className="nav-actions"><Link className="btn btn-ghost" href="/dashboard">لوحة التحكم</Link></div></div></header>
  <main className="wrap section dashboard-module-page">
    <header className="stage2-page-head">
      <div><div className="eyebrow">ذكاء المستندات</div><h1>المستندات و OCR</h1><p>رفع آمن → سجل مستند → OCR → مراجعة → اعتماد/رفض. المستندات خاصة وليست عامة.</p></div>
      <span className="stage2-badge">{integration?.state==="live"?"OCR مباشر":"OCR جاهز للتكامل"}</span>
    </header>

    <section className="stage2-panel">
      <h2>رفع مستند</h2>
      <p>PDF أو JPG أو PNG أو WEBP حتى 10MB. الرفع متاح دائمًا، بينما معالجة OCR الفعلية تتطلب مزود ذكاء اصطناعي مفعّلًا.</p>
      <div className="stage2-form-grid">
        <label>نوع المستند<select value={type} onChange={e=>setType(e.target.value)}><option value="supplier_invoice">فاتورة مورد</option><option value="expense_receipt">إيصال مصروف</option><option value="identity">هوية</option><option value="repair_photo">صورة إصلاح</option><option value="other">أخرى</option></select></label>
        <label>الملف<input id="doc-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setFile(e.target.files?.[0]??null)} disabled={busy}/></label>
        <div className="stage2-actions"><button className="btn btn-primary" disabled={busy||!file} onClick={()=>void upload()}>{busy?"جارٍ التنفيذ…":integration?.state==="live"?"رفع وتشغيل OCR":"رفع المستند"}</button></div>
      </div>
      {progress&&<div className="stage2-callout" role="status">{progress}</div>}
      {message&&<div className="stage2-alert" role="alert">{message}</div>}
    </section>

    <section className="stage2-panel">
      <div className="stage2-panel-head"><h2>سجل المستندات</h2><span>{docs.length}</span></div>
      {!docs.length?<div className="stage2-empty">لا توجد مستندات بعد.</div>:
      <div className="stage2-table-wrap"><table><thead><tr><th>النوع</th><th>الحالة</th><th>الثقة</th><th>OCR</th><th>الإجراء</th></tr></thead><tbody>{docs.map(d=><tr key={d.id}>
        <td>{({supplier_invoice:"فاتورة مورد",expense_receipt:"إيصال مصروف",identity:"هوية",repair_photo:"صورة إصلاح",other:"أخرى"} as Record<string,string>)[d.document_type] ?? d.document_type ?? "—"}</td><td>{({pending:"بانتظار المراجعة",approved:"معتمد",rejected:"مرفوض"} as Record<string,string>)[d.review_status] ?? d.review_status ?? "—"}</td><td>{d.ai_confidence==null?"—":Math.round(Number(d.ai_confidence)*100)+"%"}</td>
        <td><details><summary>عرض الاستخراج</summary><pre style={{whiteSpace:"pre-wrap",maxWidth:520}}>{JSON.stringify(d.ai_extracted_data??{},null,2)}</pre></details></td>
        <td><div className="stage2-actions">
          <button className="btn" disabled={busy||integration?.state!=="live"} onClick={()=>void action(d.id,"ocr")}>إعادة OCR</button>
          <button className="btn" disabled={busy||d.document_type!=="supplier_invoice"||d.review_status!=="approved"} onClick={()=>void openPurchaseDraft(d)}>تحويل إلى مسودة شراء</button>
          {d.review_status==="pending"&&<><button className="btn btn-primary" disabled={busy} onClick={()=>void action(d.id,"review","approved")}>اعتماد</button><button className="btn" disabled={busy} onClick={()=>void action(d.id,"review","rejected")}>رفض</button></>}
        </div></td>
      </tr>)}</tbody></table></div>}
    </section>

    {purchaseDraft&&<section className="stage2-panel" aria-label="مراجعة مسودة الشراء">
      <div className="stage2-panel-head"><div><div className="eyebrow">فاتورة معتمدة · OCR للمساعدة فقط</div><h2>مراجعة مسودة شراء</h2><p>راجع القيم يدويًا. إنشاء المسودة لا يستلم الأصناف ولا يغيّر المخزون.</p></div><button type="button" className="btn" onClick={()=>setPurchaseDraft(null)}>إغلاق</button></div>
      <div className="stage2-form-grid">
        <label>المحل<select value={purchaseDraft.storeId} onChange={e=>setPurchaseDraft(v=>v?{...v,storeId:e.target.value}:v)}>{purchaseDraft.stores.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>المورد<select value={purchaseDraft.supplierId} onChange={e=>setPurchaseDraft(v=>v?{...v,supplierId:e.target.value}:v)}><option value="">غير محدد</option>{purchaseDraft.suppliers.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{purchaseDraft.supplierName&&<small>المستخرج من الفاتورة: {purchaseDraft.supplierName}</small>}</label>
        <label>رقم فاتورة المورد<input value={purchaseDraft.invoiceNo} onChange={e=>setPurchaseDraft(v=>v?{...v,invoiceNo:e.target.value}:v)} maxLength={100}/></label>
      </div>
      <div className="stage2-table-wrap"><table><thead><tr><th>الوصف</th><th>SKU</th><th>Barcode</th><th>العيار</th><th>الكمية</th><th>الوزن غ</th><th>تكلفة الوحدة</th><th>المصنعية</th><th>VAT</th><th></th></tr></thead>
        <tbody>{purchaseDraft.lines.map((line,index)=><tr key={index}>
          {(["raw_description","sku","barcode","karat","quantity","weight_grams","unit_cost","making_charge","vat_amount"] as (keyof DraftLine)[]).map(key=><td key={key}><input aria-label={key+"-"+index} value={line[key]} onChange={e=>updateDraftLine(index,key,e.target.value)} inputMode={["quantity","weight_grams","unit_cost","making_charge","vat_amount"].includes(key)?"decimal":"text"} maxLength={key==="raw_description"?500:80}/></td>)}
          <td><button type="button" className="btn" disabled={purchaseDraft.lines.length===1} onClick={()=>setPurchaseDraft(v=>v?{...v,lines:v.lines.filter((_,i)=>i!==index)}:v)}>حذف</button></td>
        </tr>)}</tbody>
      </table></div>
      <div className="stage2-actions"><button type="button" className="btn" disabled={purchaseDraft.lines.length>=100} onClick={()=>setPurchaseDraft(v=>v?{...v,lines:[...v.lines,emptyDraftLine()]}:v)}>إضافة صنف</button><button type="button" className="btn btn-primary" disabled={busy} onClick={()=>void createPurchaseDraft()}>{busy?"جارٍ الحفظ…":"إنشاء مسودة الشراء"}</button></div>
    </section>}

  </main>
  </div>;
}
