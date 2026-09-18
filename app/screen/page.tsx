"use client";

import { useCallback, useEffect, useState } from "react";

const SESSION_KEY = "gmp_screen_session";
const SNAPSHOT_KEY = "gmp_screen_snapshot";

type DisplayPayload = {
  screen: { id: string; name: string; template: string };
  store: { id: string; name: string; currency: string; timezone: string; logo_path?: string | null; phone?: string | null; whatsapp?: string | null };
  snapshot: { perGram24k: number | null; purities: Record<string, number | null>; currency: string; spot: number | null; bid: number | null; ask: number | null; timestamp: string | null; provider: string; status: string } | null;
  status: string;
  server_time: string;
  content?: Array<{id:string;content_type:string;title:string;body?:string|null;media_path?:string|null;payload?:Record<string,unknown>;priority:number}>;
  ads?: Array<{placement:{id:string;weight:number};campaign?:{title:string;body?:string|null;image_path?:string|null;target_url?:string|null;advertiser_name?:string|null};creative?:{name:string;creative_type:string;asset_path?:string|null;target_url?:string|null}}>;
};

function formatNumber(value: number | null, digits = 3) {
  return value == null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export default function ScreenPage() {
  const [session, setSession] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [payload, setPayload] = useState<DisplayPayload | null>(null);

  const refresh = useCallback(async (token: string) => {
    try {
      const response = await fetch("/api/displays/snapshot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session: token }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as (DisplayPayload & { ok?: boolean; error?: string }) | null;
      if (response.status === 401) {
        try { window.localStorage.removeItem(SESSION_KEY); } catch {}
        setSession(null);
        setConnected(false);
        setError("انتهت جلسة الشاشة أو أُلغي الاقتران.");
        return;
      }
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "snapshot_failed");
      setPayload(data);
      setConnected(true);
      setError("");
      try { window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data)); } catch {}
    } catch {
      setConnected(false);
      setError("لا يوجد اتصال حاليًا. يتم عرض آخر لقطة صالحة وليست مباشرة.");
    }
  }, []);

  useEffect(() => {
    const bootstrapTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(SESSION_KEY);
        const cached = window.localStorage.getItem(SNAPSHOT_KEY);
        if (saved) setSession(saved);
        if (cached) setPayload(JSON.parse(cached) as DisplayPayload);
      } catch {
        setError("تعذر استعادة جلسة الشاشة المحلية.");
      }
    }, 0);
    return () => window.clearTimeout(bootstrapTimer);
  }, []);

  useEffect(() => {
    if (!session) return;
    const runRefresh = () => { void refresh(session); };
    const initialTimer = window.setTimeout(runRefresh, 0);
    const timer = window.setInterval(runRefresh, 30000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [session, refresh]);

  async function pair() {
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("أدخل رمزًا من 6 أرقام.");
    try {
      const response = await fetch("/api/displays/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; session?: string; error?: string } | null;
      if (!response.ok || !data?.ok || !data.session) {
        setError(data?.error === "invalid_or_expired" ? "الرمز غير صالح أو انتهت صلاحيته." : "تعذر إتمام الاقتران.");
        return;
      }
      try { window.localStorage.setItem(SESSION_KEY, data.session); } catch {}
      setSession(data.session);
      setCode("");
      setError("");
    } catch {
      setError("تعذر الاتصال بالخادم.");
    }
  }

  function unpair() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.localStorage.removeItem(SNAPSHOT_KEY);
    } catch {}
    setSession(null);
    setConnected(false);
    setPayload(null);
    setError("");
  }

  const snapshot = payload?.snapshot ?? null;
  const statusLabel = connected && snapshot ? (snapshot.status === "LIVE" ? "مباشر" : snapshot.status) : snapshot ? "آخر تحديث" : "غير متاح";

  return (
    <main className="screen-page">
      <div className="screen-shell">
        <section className="screen-card">
          <div className="eyebrow">الشاشة الرقمية</div>
          {!session ? (
            <div className="screen-connect-view">
              <h1>اقتران شاشة الأسعار</h1>
              <p className="screen-copy">أدخل رمز الاقتران المؤقت من لوحة إدارة الشاشات.</p>
              <div className="screen-connect">
                <input className="select screen-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" autoComplete="one-time-code" aria-label="رمز الاقتران" />
                <button className="btn primary" type="button" onClick={pair}>اقتران الشاشة</button>
                {error ? <div className="notice" role="alert">{error}</div> : null}
              </div>
            </div>
          ) : (
            <div className="screen-connected-view">
              <div className="screen-header">
                <div><div className="eyebrow">{payload?.store.name ?? "Global Market"}</div><h1>{payload?.screen.name ?? "شاشة الأسعار"}</h1></div>
                <div className="notice"><strong>{statusLabel}</strong><div className="screen-status-meta">{payload?.snapshot?.timestamp ? new Date(payload.snapshot.timestamp).toLocaleString() : "—"}</div></div>
              </div>
              <div className="gold-card screen-gold">
                <div className="screen-price-caption">ذهب 24K / غرام · {payload?.store.currency ?? "OMR"}</div>
                <div className="screen-gold-price">{formatNumber(snapshot?.perGram24k ?? null, 3)}</div>
                <div className="screen-meta-grid">
                  <div className="card"><div>السعر الفوري / الأونصة</div><strong>{formatNumber(snapshot?.spot ?? null, 3)}</strong></div>
                  <div className="card"><div>شراء مرجعي</div><strong>{formatNumber(snapshot?.bid ?? null, 3)}</strong></div>
                  <div className="card"><div>بيع مرجعي</div><strong>{formatNumber(snapshot?.ask ?? null, 3)}</strong></div>
                </div>
              </div>
              <div className="screen-purity-grid">
                {["22K", "21K", "18K", "14K"].map((k) => <div className="card" key={k}><div>{k}</div><strong>{formatNumber(snapshot?.purities?.[k] ?? null, 3)}</strong></div>)}
              </div>
              {(payload?.content?.length || payload?.ads?.length) ? <section className="screen-content-area">
                {(payload.content || []).map((item) => <article className="card screen-content-card" key={item.id}>
                  <div className="eyebrow">{item.content_type}</div><h2>{item.title}</h2>{item.body ? <p>{item.body}</p> : null}
                  {item.media_path ? <img src={item.media_path} alt="" style={{width:"100%",borderRadius:12,maxHeight:360,objectFit:"cover"}} /> : null}
                </article>)}
                {(payload.ads || []).map((ad) => <article className="card screen-ad-card" key={ad.placement.id}>
                  <div className="eyebrow">إعلان</div><h2>{ad.campaign?.title || ad.creative?.name || "محتوى مدعوم"}</h2>
                  {ad.campaign?.body ? <p>{ad.campaign.body}</p> : null}
                  {ad.campaign?.image_path ? <img src={ad.campaign.image_path} alt="" style={{width:"100%",borderRadius:12,maxHeight:360,objectFit:"cover"}} /> : null}
                  {ad.campaign?.advertiser_name ? <small>{ad.campaign.advertiser_name}</small> : null}
                </article>)}
              </section> : null}
              {error ? <div className="notice screen-error" role="status">{error}</div> : null}
              <div className="actions screen-actions"><button className="btn ghost" type="button" onClick={unpair}>إلغاء الاقتران محليًا</button></div>
            </div>
          )}
          <small className="screen-foot">الأسعار مرجعية للسوق وليست أسعار شراء أو بيع خاصة بالمحل.</small>
        </section>
      </div>
    </main>
  );
}
