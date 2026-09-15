"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "gmp_screen_session";

export default function ScreenPage() {
  const [session, setSession] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("جهاز غير مقترن");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SESSION_KEY);
      if (saved) {
        setSession(saved);
        setStatus("متصلة — جارٍ التحقق");
      }
    } catch {
      // Ignore localStorage failures; pairing can still be attempted.
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    async function heartbeat() {
      try {
        const response = await fetch("/api/displays/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ session }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("heartbeat_failed");
        if (!stopped) setStatus("متصلة");
      } catch {
        if (!stopped) setStatus("غير متصلة — محاولة إعادة الاتصال");
      }
    }
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [session]);

  async function pair() {
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("أدخل رمزًا من 6 أرقام.");
      return;
    }
    try {
      const response = await fetch("/api/displays/pair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data.session) {
        setError(data?.error === "invalid_or_expired" ? "الرمز غير صالح أو انتهت صلاحيته." : "تعذر إتمام الاقتران.");
        return;
      }
      window.localStorage.setItem(SESSION_KEY, data.session);
      setSession(data.session);
      setCode("");
      setStatus("متصلة");
    } catch {
      setError("تعذر الاتصال بالخادم.");
    }
  }

  function unpair() {
    try { window.localStorage.removeItem(SESSION_KEY); } catch {}
    setSession(null);
    setStatus("جهاز غير مقترن");
  }

  return (
    <main className="wrap section" style={{ minHeight: "100vh", display: "grid", alignItems: "center" }}>
      <section className="card" style={{ maxWidth: 760, width: "100%", margin: "0 auto", textAlign: "center" }}>
        <div className="eyebrow">DIGITAL DISPLAY</div>
        <h1>شاشة الأسعار</h1>
        <p className="hero-copy">{status}</p>

        {!session ? (
          <div className="section">
            <label className="label">رمز الاقتران<input className="select" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" autoComplete="one-time-code" /></label>
            <button className="btn primary" style={{ marginTop: 14 }} type="button" onClick={pair}>اقتران الشاشة</button>
            {error ? <div className="notice" role="alert" style={{ marginTop: 14 }}>{error}</div> : null}
          </div>
        ) : (
          <div className="notice" style={{ marginTop: 18 }}>
            هذه الشاشة تستخدم جلسة جهاز مستقلة. لا تحفظ كلمة مرور الحساب على الجهاز.
            <div className="actions" style={{ justifyContent: "center", marginTop: 12 }}>
              <button className="btn ghost" type="button" onClick={unpair}>إلغاء الاقتران محليًا</button>
            </div>
          </div>
        )}

        <div className="section" style={{ marginTop: 24 }}>
          <h2>عند انقطاع الإنترنت</h2>
          <p className="hero-copy">تُعرض آخر بيانات Snapshot صالحة مع وقت آخر تحديث، ولا تُعرض على أنها LIVE.</p>
        </div>
      </section>
    </main>
  );
}
