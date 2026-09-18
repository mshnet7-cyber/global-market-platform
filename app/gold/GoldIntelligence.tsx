"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MetalSnapshot } from "../../lib/types";
import type { PublicPricePoint } from "../../lib/market-history";
import { calculateGoldPrice, GOLD_KARATS } from "../../lib/gold-pricing";
import { formatMoneyDisplay } from "../../lib/currency-display";

function money(value: number | null | undefined, currency: string, digits = 3) { return formatMoneyDisplay(value, currency, "en-US", digits); }

function MiniChart({ points, currency }: { points: PublicPricePoint[]; currency: string }) {
  const values = points.map((p) => p.value).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length < 2) return <div className="gold-history-empty">لا توجد بيانات تاريخية كافية.</div>;
  const width=900, height=260, pad=22, min=Math.min(...values), max=Math.max(...values), span=Math.max(max-min, Math.abs(max)*1e-9, 1e-9);
  const d=points.map((p,i)=>{const v=typeof p.value==="number"&&Number.isFinite(p.value)?p.value:null;if(v==null)return null;const x=pad+(i/Math.max(1,points.length-1))*(width-pad*2);const y=height-pad-((v-min)/span)*(height-pad*2);return (i?"L":"M")+" "+x.toFixed(2)+" "+y.toFixed(2);}).filter(Boolean).join(" ");
  return <div className="gold-history"><svg viewBox={"0 0 "+width+" "+height} role="img" aria-label="Gold price history"><path d={d} className="chart-line" fill="none"/></svg><div><span>{money(min,currency)}</span><span>{money(max,currency)}</span></div></div>;
}

export default function GoldIntelligence({ language, countryCode, countryName, currency, gold, silver, history }: {
  language:string; countryCode:string; countryName:string; currency:string; gold:MetalSnapshot; silver:MetalSnapshot; history:PublicPricePoint[];
}) {
  const rtl=["ar","fa","he","ur"].includes(language);
  const [weight,setWeight]=useState("10");
  const [karat,setKarat]=useState<24|22|21|18|14>(21);
  const [direction,setDirection]=useState<"buy"|"sell">("sell");
  const [making,setMaking]=useState("1.5");
  const [wastage,setWastage]=useState("0");
  const [spread,setSpread]=useState("0");
  const [tax,setTax]=useState("0");
  const [threshold,setThreshold]=useState("");
  const [alertMessage,setAlertMessage]=useState("");
  const [alerts,setAlerts]=useState<Array<{id:string;instrument_code:string;rule_type:string;threshold:number|null;active:boolean;cooldown_minutes:number}>>([]);
  const [alertsBusy,setAlertsBusy]=useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/alerts/rules",{cache:"no-store"}).then(async response => {
      const data=await response.json().catch(()=>null);
      if(!cancelled && response.ok) setAlerts(data?.rules??[]);
    }).catch(()=>undefined);
    return()=>{cancelled=true};
  },[]);

  const calc = useMemo(() => {
    if (gold.perGram24k == null || !Number.isFinite(gold.perGram24k)) return null;
    try { return calculateGoldPrice({ marketPerGram24k:gold.perGram24k, weightGrams:Number(weight), karat, direction, spreadPerGram:Number(spread), makingPerGram:Number(making), wastagePercent:Number(wastage), taxRate:Number(tax), includeWorkmanship:true, roundingIncrement:0.001 }); }
    catch { return null; }
  }, [gold.perGram24k,weight,karat,direction,spread,making,wastage,tax]);

  async function createAlert() {
    setAlertMessage("");
    const amount=Number(threshold);
    if (!Number.isFinite(amount) || amount <= 0) { setAlertMessage("أدخل قيمة صحيحة للتنبيه."); return; }
    try {
      const response=await fetch("/api/alerts/rules",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({instrument_code:"XAU"+currency,rule_type:"price_above",threshold:amount,cooldown_minutes:30})});
      const json=await response.json().catch(()=>null);
      if(response.status===401){setAlertMessage("سجّل الدخول لإنشاء التنبيه.");return;}
      if(!response.ok){setAlertMessage(json?.error==="active_rule_exists"?"لديك تنبيه مماثل مفعّل.":"تعذر إنشاء التنبيه.");return;}
      setAlertMessage("تم إنشاء التنبيه.");
      setThreshold("");
    } catch { setAlertMessage("تعذر الاتصال بالخادم."); }
  }

  return <div className="stage1-shell" dir={rtl?"rtl":"ltr"} lang={language}>
    <header className="topbar"><div className="container nav stage1-nav"><Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link><div className="stage1-nav-title"><span className="eyebrow">ADVANCED GOLD INTELLIGENCE</span><strong>{countryName} · {currency}</strong></div><div className="nav-actions"><Link className="btn btn-ghost" href={"/markets?country=" + countryCode + "&language=" + language}>Market Terminal</Link><Link className="btn btn-primary" href="/login">الدخول</Link></div></div></header>
    <main className="container stage1-main">
      <section className="gold-intro"><div><div className="eyebrow"><span className="live-dot"/>ADVANCED GOLD INTELLIGENCE</div><h1>الذهب كنظام بيانات، لا كسعر فقط.</h1><p>الأونصة، الغرام، العيارات، Spot/Bid/Ask، التاريخ، والتحويلات المرتبطة بمحرك تسعير واحد.</p></div><div className="gold-live-card"><span>24K / GRAM</span><strong>{money(gold.perGram24k,currency)}</strong><em>{gold.status}</em><small>{gold.provider}</small></div></section>
      <section className="gold-overview"><div className="gold-spot"><span>SPOT / OUNCE</span><strong>{money(gold.spot,currency,2)}</strong><div className="gold-triple"><div><span>BID</span><b>{money(gold.bid,currency,2)}</b></div><div><span>ASK</span><b>{money(gold.ask,currency,2)}</b></div><div><span>SILVER</span><b>{money(silver.perGram24k,currency,3)}</b></div></div></div><div className="gold-purity-card"><span className="micro-label">PURITY MATRIX</span>{GOLD_KARATS.map((k)=><div key={k}><span>{k}K</span><b>{money(gold.purities[String(k)+"K"]??null,currency)}</b></div>)}</div></section>
      <section className="gold-history-card"><div className="terminal-card-head"><div><span className="micro-label">PRICE HISTORY</span><strong>آخر 24 ساعة مسجلة</strong></div><div className="terminal-source">{history.length} observations · {gold.status}</div></div><MiniChart points={history} currency={currency}/></section>
      <section className="gold-lower-grid">
        <section className="terminal-card"><div className="terminal-card-head"><div><span className="micro-label">PRICING ENGINE</span><strong>محرك تسعير الذهب</strong></div></div><div className="pricing-form-grid">
          <label>الاتجاه<select value={direction} onChange={e=>setDirection(e.target.value as "buy"|"sell")}><option value="sell">بيع للعميل</option><option value="buy">شراء من العميل</option></select></label>
          <label>الوزن<input inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
          <label>العيار<select value={karat} onChange={e=>setKarat(Number(e.target.value) as typeof karat)}>{GOLD_KARATS.map(k=><option key={k} value={k}>{k}K</option>)}</select></label>
          <label>المصنعية / غ<input inputMode="decimal" value={making} onChange={e=>setMaking(e.target.value)}/></label>
          <label>الهدر %<input inputMode="decimal" value={wastage} onChange={e=>setWastage(e.target.value)}/></label>
          <label>فرق السعر / غ<input inputMode="decimal" value={spread} onChange={e=>setSpread(e.target.value)}/></label>
          <label>الضريبة %<input inputMode="decimal" value={tax} onChange={e=>setTax(e.target.value)}/></label>
        </div>{calc ? <div className="pricing-breakdown"><div><span>قيمة المعدن</span><b>{money(calc.metalValue,currency)}</b></div><div><span>الهدر</span><b>{money(calc.wastageValue,currency)}</b></div><div><span>فرق السعر</span><b>{money(calc.spreadValue,currency)}</b></div><div><span>المصنعية</span><b>{money(calc.workmanshipValue,currency)}</b></div><div><span>الضريبة</span><b>{money(calc.taxAmount,currency)}</b></div><div className="total"><span>الإجمالي</span><b>{money(calc.total,currency)}</b></div></div> : <div className="terminal-empty">البيانات السوقية غير متاحة لإجراء الحساب.</div>}</section>
        <section className="terminal-card"><div className="terminal-card-head"><div><span className="micro-label">ALERTS</span><strong>تنبيه سعر الذهب</strong></div></div><div className="alert-form"><label>نبّهني عندما يتجاوز XAU هذه القيمة<input inputMode="decimal" value={threshold} onChange={e=>setThreshold(e.target.value)} placeholder={money(gold.spot,currency,2)}/></label><button type="button" className="btn btn-primary" onClick={createAlert}>إنشاء التنبيه</button>{alertMessage&&<div className="terminal-footnote">{alertMessage}</div>}</div><div className="terminal-footnote">التنبيهات تُسجل للحساب وتدعم القنوات المستقبلية.</div>
          <div className="alert-rules-list">
            <div className="micro-label">ACTIVE RULES</div>
            {alerts.length===0 ? <div className="terminal-empty">لا توجد تنبيهات محفوظة لهذا الحساب.</div> : alerts.map(rule=>
              <div className="alert-rule-row" key={rule.id}>
                <div><strong>{rule.instrument_code}</strong><span>{rule.rule_type} · {rule.threshold ?? "—"} · cooldown {rule.cooldown_minutes}m</span></div>
                <div className="actions">
                  <button type="button" className="btn" disabled={alertsBusy} onClick={async()=>{setAlertsBusy(true);try{const r=await fetch("/api/alerts/rules",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:rule.id,active:!rule.active})});if(r.ok){setAlerts((current)=>current.map(x=>x.id===rule.id?{...x,active:!x.active}:x));}}finally{setAlertsBusy(false)}}}>{rule.active?"تعطيل":"تفعيل"}</button>
                  <button type="button" className="btn" disabled={alertsBusy} onClick={async()=>{setAlertsBusy(true);try{const r=await fetch("/api/alerts/rules?id="+encodeURIComponent(rule.id),{method:"DELETE"});if(r.ok)setAlerts((current)=>current.filter(x=>x.id!==rule.id));}finally{setAlertsBusy(false)}}}>إلغاء</button>
                </div>
              </div>
            )}
          </div></section>
      </section>
      <div className="terminal-footnote">Trust layer: البيانات القديمة/غير الصالحة لا تُعاد تسميتها LIVE، والمصدر يظهر بجانب كل قيمة.</div>
    </main>
  </div>;
}
