"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Line={listing:any;quantity:number};

export default function MarketplacePage(){
  const AVAILABILITY_LABELS:Record<string,string>={in_stock:"متوفر",limited:"محدود",out_of_stock:"غير متوفر",on_request:"عند الطلب"};
  const [data,setData]=useState<any>({stores:[],listings:[]}),[search,setSearch]=useState(""),[cart,setCart]=useState<Line[]>([]),[buyer,setBuyer]=useState({name:"",phone:"",email:"",note:"",fulfillment_mode:"contact"}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{fetch("/api/stage2?action=marketplace",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"load_failed");setData(d)}).catch(e=>setMessage(e.message||"تعذر تحميل Marketplace")).finally(()=>setLoading(false))},[]);
  function add(listing:any){setCart(c=>{if(c.length && c[0].listing.store_id!==listing.store_id){setMessage("السلة مرتبطة بمحل واحد. أرسل الطلب الحالي أولًا ثم اختر محلًا آخر.");return c;}const found=c.find(x=>x.listing.id===listing.id);return found?c.map(x=>x.listing.id===listing.id?{...x,quantity:x.quantity+1}:x):[...c,{listing,quantity:1}]})}
  const filteredListings=useMemo(()=>{const q=search.trim().toLowerCase();if(!q)return data.listings??[];return (data.listings??[]).filter((l:any)=>[l.title,l.description,l.store?.name].some((v:any)=>String(v??"").toLowerCase().includes(q)))},[data.listings,search]);
  const total=useMemo(()=>cart.reduce((s,x)=>s+Number(x.listing.price)*x.quantity,0),[cart]);
  async function submit(){
    if(!cart.length)return setMessage("السلة فارغة");
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/stage2",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
        action:"marketplace_order",store_id:cart[0].listing.store_id,buyer_name:buyer.name,buyer_phone:buyer.phone,buyer_email:buyer.email,note:buyer.note,
        fulfillment_mode:buyer.fulfillment_mode,idempotency_key:crypto.randomUUID(),lines:cart.map(x=>({listing_id:x.listing.id,quantity:x.quantity}))
      })});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"order_failed");
      setMessage("تم إرسال طلب التواصل رقم #"+d.order_no+" للمحل. لا يوجد دفع إلكتروني في هذه المرحلة.");
      setCart([]);
    }catch(e){setMessage(e instanceof Error?e.message:"تعذر إرسال الطلب");}finally{setBusy(false);}
  }
  return <main className="stage2-public">
    <header className="stage2-public-head"><div><div className="eyebrow">السوق التجاري</div><h1>السوق</h1><p>منتجات وخدمات من محلات منشورة في دليل الذهب. الطلب هنا للتواصل/الحجز فقط؛ لا يوجد دفع إلكتروني في هذه المرحلة.</p></div><Link href="/directory" className="btn">دليل المحلات</Link></header>
    {message&&<div className="stage2-alert">{message}</div>}
    {loading?<div className="stage2-empty">جارٍ التحميل…</div>:<div className="stage2-market-layout"><section><div className="stage2-section-title"><div><h2>العروض المنشورة</h2><span>{filteredListings.length} من {data.listings.length} عرض</span></div><label className="stage2-market-search">بحث<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="اسم المنتج أو المحل"/></label></div><div className="stage2-commerce-grid">{filteredListings.map((l:any)=><article className="stage2-product-card" key={l.id}><div className="stage2-product-top"><span>{l.store?.name||"المحل"}</span><b>{AVAILABILITY_LABELS[l.availability] ?? l.availability}</b></div><h3>{l.title}</h3><p>{l.description||"—"}</p><strong>{Number(l.price).toLocaleString("ar-OM",{minimumFractionDigits:3})} {l.currency}</strong><small>{l.listing_type==="service"?"خدمة":"منتج"} · {l.contact_mode==="request"?"طلب":"تواصل"}</small><button className="btn btn-primary" onClick={()=>add(l)}>إضافة للسلة</button></article>)}{!filteredListings.length&&<div className="stage2-empty">لا توجد نتائج مطابقة للبحث.</div>}</div></section>
    <aside className="stage2-cart"><div className="stage2-panel-head"><h2>السلة</h2><span>{cart.length}</span></div>{cart.map(x=><div className="stage2-cart-line" key={x.listing.id}><div><strong>{x.listing.title}</strong><small>{x.quantity} × {x.listing.price} {x.listing.currency}</small></div><button className="btn" onClick={()=>setCart(c=>c.filter(y=>y.listing.id!==x.listing.id))}>حذف</button></div>)}{!cart.length&&<div className="stage2-empty">أضف عرضًا ثم أرسل طلب التواصل.</div>}{cart.length>0&&<><div className="stage2-cart-total"><span>الإجمالي التقديري</span><strong>{total.toLocaleString("ar-OM",{minimumFractionDigits:3})}</strong></div><label>الاسم<input value={buyer.name} onChange={e=>setBuyer({...buyer,name:e.target.value})}/></label><label>الهاتف<input value={buyer.phone} onChange={e=>setBuyer({...buyer,phone:e.target.value})}/></label><label>البريد الإلكتروني<input value={buyer.email} onChange={e=>setBuyer({...buyer,email:e.target.value})}/></label><label>الاستلام<select value={buyer.fulfillment_mode} onChange={e=>setBuyer({...buyer,fulfillment_mode:e.target.value})}><option value="contact">تواصل</option><option value="pickup">استلام</option><option value="delivery">توصيل</option></select></label><label>ملاحظة<textarea value={buyer.note} onChange={e=>setBuyer({...buyer,note:e.target.value})}/></label><button className="btn btn-primary" disabled={busy||!buyer.name||!buyer.phone} onClick={()=>void submit()}>إرسال الطلب بدون دفع</button></>}</aside></div>}
  </main>;
}
