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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SESSION_KEY);
      if (saved) setSession(saved);
      const cached = window.localStorage.getItem(SNAPSHOT_KEY);
      if (cached) setPayload(JSON.parse(cached) as DisplayPayload);
    } catch {}
  }, []);

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
        window.localStorage.removeItem(SESSION_KEY);
        setSession(null);
        setConnected(false);
        setError("انتهت جلسة الشاشة أو أُلغي الاقتران.");
        return;
      }
      if (!response.ok || !data?.ok) throw new Error("snapshot_failed");
      setPayload(data);
      setConnected(true);
      setError("");
      try { window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data)); } catch {}
    } catch {
      setConnected(false);
      setError("");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    refresh(session);
    const timer = window.setInterval(() => refresh(session), 30000);
    return () => window.clearInterval(timer);
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
      window.localStorage.setItem(SESSION_KEY, data.session);
      setSession(data.session);
      setCode("");
      setError("");
    } catch { setError("تعذر الاتصال بالخادم."); }
  }

  function unpair() {
    try { window.localStorage.removeItem(SESSION_KEY); } catch {}
    setSession(null);
    setConnected(false);
    setPayload(null);
  }

  const snapshot = payload?.snapshot ?? null;
  const statusLabel = connected && snapshot ? (snapshot.status === "LIVE" ? "LIVE" : snapshot.status) : snapshot ? "LAST UPDATE" : "UNAVAILABLE";

  return (
    <main className="wrap section" style={{ minHeight: "100vh", display: "grid", alignItems: "center" }}>
      <section className="card" style={{ width: "100%", margin: "0 auto", maxWidth: 1100, textAlign: "center" }}>
        <div className="eyebrow">DIGITAL DISPLAY</div>
        {!session ? (
          <>
            <h1>اقتران شاشة الأسعار</h1>
            <p className="hero-copy">أدخل رمز الاقتران المؤقت من لوحة إدارة الشاشات.</p>
            <div className="section" style={{ maxWidth: 420, margin: "0 auto" }}>
              <input className="select" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" autoComplete="one-time-code" aria-label="رمز الاقتران" />
              <button className="btn primary" style={{ marginTop: 14 }} type="button" onClick={pair}>اقتران الشاشة</button>
              {error ? <div className="notice" role="alert" style={{ marginTop: 14 }}>{error}</div> : null}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ textAlign: "right" }}><div className="eyebrow">{payload?.store.name ?? "Global Market"}</div><h1 style={{ marginBottom: 4 }}>{payload?.screen.name ?? "شاشة الأسعار"}</h1></div>
              <div className="notice" style={{ margin: 0 }}><strong>{statusLabel}</strong><div style={{ fontSize: 12, marginTop: 4 }}>{payload?.snapshot?.timestamp ? new Date(payload.snapshot.timestamp).toLocaleString() : "—"}</div></div>
            </div>
            <div className="gold-card" style={{ marginTop: 24 }}>
              <div style={{ fontSize: 14, opacity: 0.75 }}>24K GOLD / GRAM · {payload?.store.currency ?? "OMR"}</div>
              <div style={{ fontSize: "clamp(3rem, 9vw, 7rem)", fontWeight: 900, lineHeight: 1.05, marginTop: 8 }}>{formatNumber(snapshot?.perGram24k ?? null, 3)}</div>
              <div className="grid three-col" style={{ marginTop: 22 }}>
                <div className="card"><div>Spot / Ounce</div><strong>{formatNumber(snapshot?.spot ?? null, 3)}</strong></div>
                <div className="card"><div>Bid</div><strong>{formatNumber(snapshot?.bid ?? null, 3)}</strong></div>
                <div className="card"><div>Ask</div><strong>{formatNumber(snapshot?.ask ?? null, 3)}</strong></div>
              </div>
            </div>
            <div className="grid five" style={{ marginTop: 18 }}>
              {(["22K", "21K", "18K", "14K"] as const).map((k) => <div className="card" key={k}><div>{k}</div><strong>{formatNumber(snapshot?.purities?.[k] ?? null, 3)}</strong></div>)}
            </div>
            {error ? <div className="notice" style={{ marginTop: 16 }}>لا يوجد اتصال حاليًا. يتم عرض آخر Snapshot صالح وليس LIVE.</div> : null}
            <div className="actions" style={{ justifyContent: "center", marginTop: 18 }}><button className="btn ghost" type="button" onClick={unpair}>إلغاء الاقتران محليًا</button></div>
          </>
        )}
        <div className="section" style={{ marginTop: 22 }}><small>الأسعار مرجعية للسوق وليست أسعار شراء أو بيع خاصة بالمحل.</small></div>
      </section>
    </main>
  );
}
