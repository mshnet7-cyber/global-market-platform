"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Product={id:string;name:string;sku:string|null;barcode:string|null;karat:string|null;weight_grams:number|null;price:number;making_charge:number;current_quantity:number;current_weight_grams:number};
type Store={id:string;name:string;branch_id:string|null;currency:string};
type Customer={id:string;name:string;phone:string|null};
type Line={product_id:string;quantity:string;weight_grams:string;unit_price:string;making_charge:string;discount_amount:string;vat_amount:string};

const money=(v:number)=>v.toLocaleString("en-OM",{minimumFractionDigits:3,maximumFractionDigits:3});

export default function SalesForm({stores,products,customers,recentSales}:{stores:Store[];products:Product[];customers:Customer[];recentSales:Array<any>}){
 const [storeId,setStoreId]=useState(stores[0]?.id??"");
 const [customerId,setCustomerId]=useState("");
 const [paymentMethod,setPaymentMethod]=useState("cash");
 const [notes,setNotes]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<any>(null);
 const [lines,setLines]=useState<Line[]>([{product_id:products[0]?.id??"",quantity:"1",weight_grams:String(products[0]?.weight_grams??0),unit_price:String(products[0]?.price??0),making_charge:String(products[0]?.making_charge??0),discount_amount:"0",vat_amount:"0"}]);

 const selectedProducts=useMemo(()=>lines.map(l=>products.find(p=>p.id===l.product_id)),[lines,products]);
 const totals=useMemo(()=>lines.reduce((a,l)=>{
   const base=Number(l.quantity||0)*Number(l.unit_price||0)+Number(l.making_charge||0);
   const discount=Number(l.discount_amount||0),vat=Number(l.vat_amount||0);
   return {subtotal:a.subtotal+base,discount:a.discount+discount,vat:a.vat+vat,total:a.total+base-discount+vat};
 },{subtotal:0,discount:0,vat:0,total:0}),[lines]);

 function updateLine(i:number,patch:Partial<Line>){setLines(xs=>xs.map((x,n)=>n===i?{...x,...patch}:x));}
 function selectProduct(i:number,id:string){
   const p=products.find(x=>x.id===id);
   updateLine(i,{product_id:id,unit_price:String(p?.price??0),weight_grams:String(p?.weight_grams??0),making_charge:String(p?.making_charge??0)});
 }
 function addLine(){
   const p=products[0];
   if(p)setLines(xs=>[...xs,{product_id:p.id,quantity:"1",weight_grams:String(p.weight_grams??0),unit_price:String(p.price),making_charge:String(p.making_charge??0),discount_amount:"0",vat_amount:"0"}]);
 }
 async function submit(){
   setBusy(true);setResult(null);
   try{
     const res=await fetch("/api/merchant/sales",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
       store_id:storeId,branch_id:stores.find(s=>s.id===storeId)?.branch_id??null,customer_id:customerId||null,payment_method:paymentMethod,notes:notes||null,
       lines:lines.map(l=>({product_id:l.product_id,quantity:Number(l.quantity),weight_grams:Number(l.weight_grams),unit_price:Number(l.unit_price),making_charge:Number(l.making_charge),discount_amount:Number(l.discount_amount),vat_amount:Number(l.vat_amount)}))
     })});
     const data=await res.json();
     if(!res.ok)throw new Error(data.error??"تعذر إتمام البيع");
     setResult(data);setNotes("");
   }catch(e){setResult({error:e instanceof Error?e.message:"حدث خطأ غير متوقع"})}
   finally{setBusy(false)}
 }
 if(!stores.length)return <div className="notice">لا يوجد متجر متاح لهذا الحساب.</div>;
 if(!products.length)return <div className="notice">لا توجد أصناف نشطة. أضف صنفًا إلى المخزون أولًا.</div>;

 return <div>
  <section className="card" style={{marginTop:24}}>
   <div className="grid three-col">
    <label className="label">المحل<select className="select" value={storeId} onChange={e=>setStoreId(e.target.value)}>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label className="label">العميل<select className="select" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">عميل نقدي / بدون عميل</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?" · "+c.phone:""}</option>)}</select></label>
    <label className="label">طريقة الدفع<select className="select" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">نقدي</option><option value="bank">تحويل/بنك</option><option value="card">بطاقة</option><option value="wallet">محفظة</option><option value="other">أخرى</option></select></label>
   </div>
   <div style={{overflowX:"auto",marginTop:18}}>
    <table><thead><tr><th>الصنف</th><th>الكمية</th><th>الوزن</th><th>سعر الوحدة</th><th>المصنعية</th><th>الخصم</th><th>VAT</th><th>الإجمالي</th><th></th></tr></thead>
    <tbody>{lines.map((l,i)=>{const p=selectedProducts[i];const total=Number(l.quantity||0)*Number(l.unit_price||0)+Number(l.making_charge||0)-Number(l.discount_amount||0)+Number(l.vat_amount||0);return <tr key={i}>
      <td><select className="select" value={l.product_id} onChange={e=>selectProduct(i,e.target.value)}>{products.map(x=><option key={x.id} value={x.id}>{x.name}{x.karat?" · "+x.karat:""}{x.barcode?" · "+x.barcode:""}</option>)}</select></td>
      <td><input className="select" inputMode="decimal" value={l.quantity} onChange={e=>updateLine(i,{quantity:e.target.value})}/></td>
      <td><input className="select" inputMode="decimal" value={l.weight_grams} onChange={e=>updateLine(i,{weight_grams:e.target.value})}/></td>
      <td><input className="select" inputMode="decimal" value={l.unit_price} onChange={e=>updateLine(i,{unit_price:e.target.value})}/></td>
      <td><input className="select" inputMode="decimal" value={l.making_charge} onChange={e=>updateLine(i,{making_charge:e.target.value})}/></td>
      <td><input className="select" inputMode="decimal" value={l.discount_amount} onChange={e=>updateLine(i,{discount_amount:e.target.value})}/></td>
      <td><input className="select" inputMode="decimal" value={l.vat_amount} onChange={e=>updateLine(i,{vat_amount:e.target.value})}/></td>
      <td><strong>{money(total)}</strong><small style={{display:"block"}}>{p?.current_quantity??0} متاح</small></td>
      <td><button type="button" className="btn" disabled={lines.length===1} onClick={()=>setLines(xs=>xs.filter((_,n)=>n!==i))}>حذف</button></td>
    </tr>})}</tbody></table>
   </div>
   <div className="actions" style={{marginTop:14}}><button type="button" className="btn" onClick={addLine}>+ إضافة صنف</button></div>
   <div className="grid two-col" style={{marginTop:16}}>
    <label className="label">ملاحظات<input className="select" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="ملاحظة تظهر مع العملية"/></label>
    <div className="card" style={{padding:14}}><div>قبل الضريبة: <strong>{money(totals.subtotal)}</strong></div><div>الخصم: <strong>{money(totals.discount)}</strong></div><div>VAT: <strong>{money(totals.vat)}</strong></div><div style={{fontSize:20,marginTop:6}}>الإجمالي: <strong>{money(totals.total)}</strong></div></div>
   </div>
   <div className="actions" style={{marginTop:16}}><button className="btn primary" onClick={()=>void submit()} disabled={busy}>{busy?"جارٍ الترحيل…":"اعتماد الفاتورة"}</button>{result?.invoice_no&&<><span className="notice">تم إصدار الفاتورة #{result.invoice_no} بإجمالي {result.total}.</span><Link className="btn" href="/dashboard/invoices">فتح سجل الفواتير</Link></>}{result?.error&&<span className="notice">{result.error}</span>}</div>
  </section>
  <section className="card" style={{marginTop:20}}>
   <div className="section-head"><div><div className="eyebrow">سجل الفواتير</div><h2>آخر الفواتير</h2></div><Link href="/dashboard/invoices" className="btn">عرض الكل</Link></div>
   <div className="stage2-table-wrap"><table><thead><tr><th>الفاتورة</th><th>العميل</th><th>الإجمالي</th><th>الدفع</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>{recentSales.map(s=><tr key={s.id}><td>#{s.invoice_no}</td><td>{customers.find(c=>c.id===s.customer_id)?.name??"نقدي"}</td><td>{money(Number(s.total||0))}</td><td>{s.payment_method??"—"}</td><td>{s.status}</td><td>{s.issued_at?new Date(s.issued_at).toLocaleString("ar-OM"):"—"}</td></tr>)}</tbody></table></div>
  </section>
 </div>;
}
