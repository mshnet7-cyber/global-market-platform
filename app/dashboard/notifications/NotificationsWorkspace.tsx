"use client";
import { useState } from "react";

type Notification={id:string;type:string;title:string;body:string|null;read_at:string|null;created_at:string};

export default function NotificationsWorkspace({initialNotifications}:{initialNotifications:Notification[]}){
  const [items,setItems]=useState(initialNotifications);
  const [busy,setBusy]=useState<string|null>(null);
  async function markRead(id:string){
    setBusy(id);
    try{
      const r=await fetch("/api/notifications",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id})});
      if(r.ok)setItems(current=>current.map(item=>item.id===id?{...item,read_at:new Date().toISOString()}:item));
    }finally{setBusy(null);}
  }
  if(!items.length)return <section className="card empty-state">لا توجد إشعارات حتى الآن.</section>;
  return <section className="section">
    <div className="grid">{items.map(item=><article className="card" key={item.id} style={{borderColor:item.read_at?undefined:"rgba(216,178,92,.35)"}}>
      <div className="card-top"><strong>{item.title}</strong><span className="status">{item.read_at?"مقروء":"جديد"}</span></div>
      <div className="meta" style={{marginTop:7}}>{item.type} · {new Date(item.created_at).toLocaleString("ar-OM")}</div>
      {item.body&&<p className="hero-copy">{item.body}</p>}
      {!item.read_at&&<button type="button" className="btn" disabled={busy===item.id} onClick={()=>void markRead(item.id)}>{busy===item.id?"جارٍ الحفظ…":"تحديد كمقروء"}</button>}
    </article>)}</div>
  </section>;
}
