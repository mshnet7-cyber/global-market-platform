"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Row = Record<string, unknown>;
type StoreOption = { id: string; name: string; branch_id: string | null; currency: string | null; timezone: string | null };
function Field({name,label,type="text",required=false,min}:{name:string;label:string;type?:string;required?:boolean;min?:string}){return <label className="field"><span>{label}</span><input name={name} type={type} required={required} min={min} step={type==="number"?"0.001":undefined} /></label>}
function StoreField({stores}:{stores:StoreOption[]}){return <label className="field"><span>المتجر</span><select name="store_id" required defaultValue=""><option value="" disabled>اختر المتجر</option>{stores.map((store)=><option key={store.id} value={store.id}>{store.name}</option>)}</select>{stores.length===0&&<small className="meta">لا يوجد متجر نشط مرتبط بهذا الحساب.</small>}</label>}

export default function ModuleWorkspace({module,stores}:{module:string;stores:StoreOption[]}){
  const [rows,setRows]=useState<Row[]>([]),[accounts,setAccounts]=useState<Row[]>([]),[entries,setEntries]=useState<Row[]>([]),[summary,setSummary]=useState<Row|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const load=useCallback(async()=>{
    try {
      const r=await fetch(`/api/merchant/operations?module=${encodeURIComponent(module)}&limit=30`,{cache:"no-store"});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setMessage(d?.error??"تعذر تحميل البيانات");return;}
      setRows(d?.rows??[]);setAccounts(d?.accounts??[]);setEntries(d?.entries??[]);setSummary(d?.summary??null);
    } catch { setMessage("تعذر الاتصال بالخادم"); }
  },[module]);
  useEffect(()=>{void load();},[load]);

  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const form=e.currentTarget;
    setBusy(true);setMessage("");
    try {
      const obj=Object.fromEntries(new FormData(form).entries()) as Record<string,string>;
      const payload:Record<string,unknown>={module};
      for(const [k,v] of Object.entries(obj)) payload[k]=v;
      if(module==="purchases"){
        payload.lines=[{raw_description:obj.raw_description,quantity:Number(obj.quantity),unit_cost:Number(obj.unit_cost),weight_grams:Number(obj.weight_grams||0),vat_amount:Number(obj.vat_amount||0)}];
        delete payload.raw_description;delete payload.quantity;delete payload.unit_cost;delete payload.weight_grams;delete payload.vat_amount;
      }
      if(module==="accounting"){
        const amount=Number(obj.amount);
        payload.lines=[{account_id:obj.debit_account,debit:amount,credit:0},{account_id:obj.credit_account,debit:0,credit:amount}];
        delete payload.debit_account;delete payload.credit_account;delete payload.amount;
      }
      const r=await fetch("/api/merchant/operations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>null);
      if(!r.ok){setMessage(d?.error??"تعذر الحفظ");return;}
      setMessage("تم الحفظ بنجاح");form.reset();await load();
    } catch { setMessage("تعذر الاتصال بالخادم"); }
    finally { setBusy(false); }
  };

  const form=()=> <form className="card" onSubmit={submit}>
    {module==="expenses"&&<><Field name="category" label="التصنيف" required/><Field name="amount" label="المبلغ" type="number" min="0.001" required/><Field name="vat_amount" label="ضريبة القيمة المضافة" type="number" min="0"/><Field name="expense_date" label="التاريخ" type="date"/><Field name="description" label="الوصف"/></>}
    {module==="repairs"&&<><Field name="item_description" label="وصف القطعة" required/><Field name="weight_received_grams" label="الوزن المستلم (غرام)" type="number" min="0" required/><Field name="metal" label="المعدن"/><Field name="karat" label="العيار"/><Field name="repair_type" label="نوع الإصلاح"/><Field name="expected_days" label="المدة المتوقعة (أيام)" type="number" min="0"/><Field name="amount" label="المبلغ" type="number" min="0"/></>}
    {module==="buy-gold"&&<><Field name="seller_name" label="اسم البائع" required/><Field name="seller_phone" label="الهاتف" required/><Field name="identity_document_path" label="مرجع وثيقة الهوية الآمن" required/><Field name="weight_grams" label="الوزن (غرام)" type="number" min="0.001" required/><Field name="karat" label="العيار"/><Field name="market_reference_price" label="سعر السوق المرجعي" type="number" min="0"/><Field name="purchase_price" label="سعر الشراء" type="number" min="0.001" required/><label className="field"><span>طريقة الدفع</span><select name="payment_method" defaultValue="cash"><option value="cash">نقدي</option><option value="bank">تحويل بنكي</option><option value="card">بطاقة</option><option value="wallet">محفظة</option><option value="other">أخرى</option></select></label></>}
    {module==="inventory"&&<><StoreField stores={stores}/><Field name="name" label="اسم الصنف" required/><Field name="sku" label="SKU"/><Field name="barcode" label="الباركود"/><Field name="karat" label="العيار"/><Field name="price" label="سعر البيع" type="number" min="0" required/><Field name="cost_price" label="سعر التكلفة" type="number" min="0"/><Field name="current_quantity" label="الكمية الابتدائية" type="number" min="0"/><Field name="current_weight_grams" label="الوزن الابتدائي (غرام)" type="number" min="0"/></>}
    {module==="purchases"&&<><StoreField stores={stores}/><Field name="raw_description" label="وصف الصنف" required/><Field name="quantity" label="الكمية" type="number" min="0.001" required/><Field name="weight_grams" label="الوزن (غرام)" type="number" min="0"/><Field name="unit_cost" label="تكلفة الوحدة" type="number" min="0" required/><Field name="vat_amount" label="الضريبة" type="number" min="0"/></>}
    {module==="accounting"&&<><label className="field"><span>الحساب المدين</span><select name="debit_account" required><option value="">اختر</option>{accounts.map(a=><option key={String(a.id)} value={String(a.id)}>{String(a.code)} — {String(a.name)}</option>)}</select></label><label className="field"><span>الحساب الدائن</span><select name="credit_account" required><option value="">اختر</option>{accounts.map(a=><option key={String(a.id)} value={String(a.id)}>{String(a.code)} — {String(a.name)}</option>)}</select></label><Field name="amount" label="المبلغ" type="number" min="0.001" required/><Field name="description" label="البيان" required/><Field name="entry_date" label="التاريخ" type="date"/></>}
    <button className="btn primary" disabled={busy||((module==="inventory"||module==="purchases")&&stores.length===0)}>{busy?"جاري الحفظ…":"حفظ"}</button>{message&&<div className="meta" style={{marginTop:10}} role="status">{message}</div>}
  </form>;
  return <>
    <div className="actions" style={{marginBottom:20}}><Link href="/dashboard" className="btn">العودة للوحة</Link>{module!=="accounting"&&<Link href="/dashboard/sales" className="btn">بيع سريع</Link>}</div>
    {module!=="tax"&&<section className="grid two">{form()}<div className="card"><div className="card-title">آخر السجلات</div>{rows.length===0&&entries.length===0?<div className="meta">لا توجد سجلات حتى الآن.</div>:(rows.length?rows.slice(0,10).map((r,i)=><div key={i} className="list-row"><strong>{String(r.name??r.category??r.item_description??r.seller_name??r.raw_description??r.invoice_no??r.id??"سجل")}</strong><span>{String(r.status??r.amount??r.total??"")}</span></div>):entries.slice(0,10).map((r,i)=><div key={i} className="list-row"><strong>{String(r.entry_no??"")}</strong><span>{String(r.description??"")}</span></div>))}</div></section>}
    {module==="accounting"&&<section className="card" style={{marginTop:20}}><div className="card-title">دليل الحسابات</div>{accounts.map(a=><div className="list-row" key={String(a.id)}><strong>{String(a.code)}</strong><span>{String(a.name)}</span></div>)}</section>}
    {module==="tax"&&<section className="card"><div className="card-title">ملخص الفترة</div>{summary&&<div className="grid three"><div className="card"><div className="metric">{Number(summary.sales_total??0).toFixed(3)} ر.ع</div><div className="meta">إجمالي المبيعات</div></div><div className="card"><div className="metric">{Number(summary.output_vat??0).toFixed(3)} ر.ع</div><div className="meta">ضريبة المخرجات</div></div><div className="card"><div className="metric">{Number(summary.net_vat??0).toFixed(3)} ر.ع</div><div className="meta">صافي الضريبة</div></div></div>}<p className="hero-copy" style={{marginTop:16}}>تقرير داخلي للمراجعة والتجهيز فقط، وليس إرسالًا حكوميًا.</p></section>}
  </>;
}
