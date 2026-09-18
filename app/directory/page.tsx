"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DirectoryPage(){
  const [rows,setRows]=useState<any[]>([]),[selected,setSelected]=useState<any>(null),[q,setQ]=useState(""),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
  async function load(){setLoading(true);try{const r=await fetch("/api/stage2?action=directory&q="+encodeURIComponent(q),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر التحميل");setRows(d.rows||[]);}catch(e){setMessage(e instanceof Error?e.message:"تعذر التحميل");}finally{setLoading(false);}}
  useEffect(()=>{const t=setTimeout(()=>void load(),180);return()=>clearTimeout(t)},[q]);
  async function openStore(slug:string){try{const r=await fetch("/api/stage2?action=store&slug="+encodeURIComponent(slug),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر فتح الملف");setSelected(d);}catch(e){setMessage(e instanceof Error?e.message:"تعذر فتح الملف");}}
  return <div className="page-frame store-directory-page" lang="ar" dir="rtl">
    <header className="topbar"><div className="container nav site-nav">
      <Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link>
      <nav className="nav-links" aria-label="التنقل الرئيسي">
        <Link href="/gold">الذهب</Link><Link href="/silver">الفضة</Link><Link href="/markets">الأسواق</Link><Link href="/stocks">الأسهم</Link><Link href="/news">الأخبار</Link><Link href="/pricing">الباقات</Link>
      </nav>
      <div className="nav-actions"><Link className="btn btn-ghost" href="/login">تسجيل الدخول</Link><Link className="btn btn-primary" href="/demo">المعاينة</Link></div>
    </div></header>
    <main className="stage2-public">
    <header className="stage2-public-head"><div><div className="eyebrow"><span className="live-dot" />GOLD STORES DIRECTORY</div><h1>دليل محلات الذهب</h1><p>ملفات تجارية مرتبطة بمنصة الذهب، مع موقع وخدمات وفروع وقنوات تواصل وحالة نشر.</p></div><div><Link href="/marketplace" className="btn btn-primary">فتح Marketplace</Link></div></header>
    <section className="stage2-search"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث باسم المحل أو المدينة أو الفئة…" /></section>
    {message&&<div className="stage2-alert">{message}</div>}
    {loading?<div className="stage2-empty">جارٍ التحميل…</div>:<div className="stage2-public-grid">{rows.map(r=><article className="stage2-store-card" key={r.store_id}>
      <div className="stage2-store-mark">{(r.store?.name||"G").slice(0,1)}</div><div className="stage2-store-main"><div className="stage2-panel-head"><h2>{r.store?.name||"Store"}</h2><span className="stage2-badge">{r.verified_at?"Verified":"Published"}</span></div>
      <p>{r.description||"ملف محل الذهب على المنصة."}</p><div className="stage2-meta-line">{[r.category,r.city,r.region].filter(Boolean).join(" · ")||"—"}</div>
      <div className="stage2-tags">{(Array.isArray(r.services)?r.services:[]).slice(0,5).map((s:string)=><span key={s}>{s}</span>)}</div>
      <div className="stage2-actions"><button className="btn btn-primary" onClick={()=>void openStore(r.store?.slug||"")}>فتح الملف</button>{r.store?.phone&&<a className="btn" href={"tel:"+r.store.phone}>اتصال</a>}{r.store?.whatsapp&&<a className="btn" href={"https://wa.me/"+r.store.whatsapp.replace(/\D/g,"")}>تواصل</a>}</div>
      </div>
    </article>)}</div>}
    {selected&&<div className="stage2-drawer" role="dialog" aria-modal="true"><div className="stage2-drawer-panel"><button className="stage2-close" onClick={()=>setSelected(null)}>×</button><div className="eyebrow">STORE PROFILE</div><h2>{selected.store.name}</h2><p>{selected.directory.description||"—"}</p><div className="stage2-detail-grid"><div><span>الموقع</span><strong>{[selected.directory.address,selected.directory.city,selected.directory.region].filter(Boolean).join(" · ")||"—"}</strong></div><div><span>ساعات العمل</span><strong>{selected.directory.hours&&Object.keys(selected.directory.hours).length?"مُعرّفة":"غير مضافة"}</strong></div><div><span>الخدمات</span><strong>{(selected.directory.services||[]).join(" · ")||"—"}</strong></div><div><span>الفروع</span><strong>{(selected.branches||[]).length}</strong></div></div>
      <h3>المنتجات والخدمات</h3><div className="stage2-mini-list">{(selected.listings||[]).map((l:any)=><div key={l.id}><strong>{l.title}</strong><span>{Number(l.price).toLocaleString("en-OM")} {l.currency} · {l.availability}</span></div>)}{!(selected.listings||[]).length&&<div>لا توجد عروض منشورة.</div>}</div>
      <div className="stage2-actions"><Link className="btn btn-primary" href="/marketplace">افتح Marketplace</Link>{selected.store.website&&<a className="btn" href={selected.store.website} target="_blank" rel="noreferrer">الموقع</a>}</div>
    </div></div>}
  </main>
  </div>;
}
