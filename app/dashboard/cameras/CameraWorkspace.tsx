"use client";
import { FormEvent, useEffect, useState } from "react";

type Camera={id:string;name:string;camera_type:string;protocol:string;endpoint_url:string|null;stream_url:string|null;stream_kind:string|null;status:string;enabled:boolean;last_seen_at:string|null;last_error:string|null;store_id:string|null;branch_id:string|null};
type Option={id:string;name:string;branch_id?:string|null};

const statusLabel:Record<string,string>={unconfigured:"غير مهيأة",online:"متصلة",offline:"غير متصلة",error:"خطأ",disabled:"معطلة"};
export default function CameraWorkspace({stores,branches}:{stores:Option[];branches:Option[]}){
 const [rows,setRows]=useState<Camera[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const load=async()=>{const r=await fetch("/api/merchant/cameras",{cache:"no-store"});const d=await r.json().catch(()=>null);if(r.ok)setRows(d.rows??[]);else setMessage(d?.error??"تعذر تحميل الكاميرات");};
 useEffect(()=>{void load();},[]);
 const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setBusy(true);setMessage("");const obj=Object.fromEntries(new FormData(e.currentTarget).entries());const r=await fetch("/api/merchant/cameras",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(obj)});const d=await r.json().catch(()=>null);if(!r.ok)setMessage(d?.error??"تعذر الحفظ");else{e.currentTarget.reset();setMessage("تمت إضافة الكاميرا");await load();}setBusy(false);};
 const update=async(id:string,patch:Record<string,unknown>)=>{const r=await fetch("/api/merchant/cameras",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...patch})});const d=await r.json().catch(()=>null);if(!r.ok)setMessage(d?.error??"تعذر التعديل");else await load();};
 const remove=async(id:string)=>{if(!confirm("حذف هذه الكاميرا؟"))return;const r=await fetch(`/api/merchant/cameras?id=${encodeURIComponent(id)}`,{method:"DELETE"});if(!r.ok){const d=await r.json().catch(()=>null);setMessage(d?.error??"تعذر الحذف");}else await load();};
 return <>
  <form className="card grid two" onSubmit={submit}>
   <label className="field"><span>اسم الكاميرا</span><input name="name" required maxLength={120} placeholder="مثال: كاميرا المدخل" /></label>
   <label className="field"><span>نوع الجهاز</span><select name="camera_type" defaultValue="ip"><option value="ip">IP Camera</option><option value="nvr">NVR</option><option value="dvr">DVR</option><option value="other">أخرى</option></select></label>
   <label className="field"><span>البروتوكول</span><select name="protocol" defaultValue="rtsp"><option>rtsp</option><option>onvif</option><option>https</option><option>http</option><option>hls</option><option>webrtc</option><option>other</option></select></label>
   <label className="field"><span>المتجر</span><select name="store_id" defaultValue=""><option value="">بدون متجر محدد</option>{stores.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
   <label className="field"><span>الفرع</span><select name="branch_id" defaultValue=""><option value="">بدون فرع محدد</option>{branches.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
   <label className="field"><span>عنوان الجهاز بدون كلمة مرور</span><input name="endpoint_url" placeholder="rtsp://192.168.1.10:554/..." /></label>
   <label className="field"><span>مرجع بيانات الدخول السري</span><input name="endpoint_secret_ref" placeholder="secret://camera/entry-01" /></label>
   <label className="field"><span>رابط البث داخل المتصفح (اختياري)</span><input name="stream_url" placeholder="https://.../stream.m3u8" /></label>
   <label className="field"><span>نوع البث</span><select name="stream_kind" defaultValue=""><option value="">غير محدد</option><option value="hls">HLS</option><option value="http">HTTP</option><option value="https">HTTPS</option><option value="mp4">MP4</option><option value="webrtc">WebRTC</option></select></label>
   <div className="actions" style={{alignItems:"end"}}><button className="btn primary" disabled={busy}>{busy?"جارٍ الحفظ…":"إضافة الكاميرا"}</button></div>
  </form>
  {message&&<div className="notice" role="status" style={{marginTop:14}}>{message}</div>}
  <section className="grid two" style={{marginTop:20}}>{rows.length===0?<div className="card meta">لا توجد كاميرات مضافة.</div>:rows.map(camera=><article className="card" key={camera.id}>
    <div className="card-top"><strong>{camera.name}</strong><span className="status">{statusLabel[camera.status]??camera.status}</span></div>
    <div className="meta" style={{marginTop:8}}>{camera.camera_type} · {camera.protocol}{camera.endpoint_url?` · ${camera.endpoint_url}`:""}</div>
    {camera.stream_url?<div style={{marginTop:14}}><video controls playsInline preload="metadata" src={camera.stream_url} style={{width:"100%",borderRadius:12,background:"#111",minHeight:220}} /><div className="meta" style={{marginTop:6}}>المشاهدة المباشرة تعتمد على دعم المتصفح لصيغة البث. RTSP يحتاج بوابة Media/WebRTC ولا يتم تشغيله مباشرة من المتصفح.</div></div>:<div className="notice" style={{marginTop:14}}>لا يوجد رابط بث متصفح. تم حفظ إعداد الجهاز ويمكن ربطه لاحقًا ببوابة البث الآمنة.</div>}
    {camera.last_error&&<div className="notice" style={{marginTop:10}}>آخر خطأ: {camera.last_error}</div>}
    <div className="actions" style={{marginTop:14}}><button className="btn" onClick={()=>void update(camera.id,{status:camera.status==="disabled"?"unconfigured":"disabled"})}>{camera.status==="disabled"?"تفعيل":"تعطيل"}</button><button className="btn" onClick={()=>void update(camera.id,{enabled:!camera.enabled})}>{camera.enabled?"إيقاف التمكين":"تمكين"}</button><button className="btn danger" onClick={()=>void remove(camera.id)}>حذف</button></div>
  </article>)}</section>
 </>;
}
