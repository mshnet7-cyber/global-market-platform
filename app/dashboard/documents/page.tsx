"use client";

import { useCallback, useEffect, useState } from "react";

type Doc=any;

export default function DocumentsPage(){
  const [docs,setDocs]=useState<Doc[]>([]);
  const [integration,setIntegration]=useState<any>(null);
  const [file,setFile]=useState<File|null>(null);
  const [type,setType]=useState("supplier_invoice");
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState("");
  const [message,setMessage]=useState("");

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
    <header className="topbar"><div className="container nav site-nav"><a href="/dashboard" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></a><nav className="nav-links" aria-label="تنقل لوحة المحل"><a href="/dashboard">الرئيسية</a><a href="/dashboard/sales">المبيعات</a><a href="/dashboard/inventory">المخزون</a><a href="/dashboard/reports">التقارير</a><a href="/dashboard/integrations">التكاملات</a></nav><div className="nav-actions"><a className="btn btn-ghost" href="/dashboard">لوحة التحكم</a></div></div></header>
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
          {d.review_status==="pending"&&<><button className="btn btn-primary" disabled={busy} onClick={()=>void action(d.id,"review","approved")}>اعتماد</button><button className="btn" disabled={busy} onClick={()=>void action(d.id,"review","rejected")}>رفض</button></>}
        </div></td>
      </tr>)}</tbody></table></div>}
    </section>
  </main>
  </div>;
}
