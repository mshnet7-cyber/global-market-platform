"use client";

import { useEffect, useState } from "react";

export type DisplayItem = {
  id: string;
  name: string;
  status: string;
  template: string;
  storeName: string;
};

const labels: Record<string, string> = {
  unpaired: "غير مقترنة",
  pairing: "بانتظار الاقتران",
  connected: "متصلة",
  offline: "غير متصلة",
  revoked: "ملغاة",
  expired: "منتهية",
};

type PairCode = { code: string; expiresAt: string };

function formatRemaining(expiresAt: string, nowMs: number) {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - nowMs);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function DisplayManager({ displays }: { displays: DisplayItem[] }) {
  const [codes, setCodes] = useState<Record<string, PairCode>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!Object.keys(codes).length) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [codes]);

  async function generateCode(screenId: string) {
    setBusy(screenId);
    setMessage("");
    try {
      const response = await fetch("/api/displays/pair-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ screen_id: screenId }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setMessage("تعذر إنشاء رمز الاقتران. تحقق من الجلسة وإعدادات الشاشة.");
        return;
      }
      setCodes((current) => ({ ...current, [screenId]: { code: String(data.code), expiresAt: String(data.expires_at) } }));
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(screenId: string) {
    setBusy(screenId);
    setMessage("");
    try {
      const form = new FormData();
      form.set("screen_id", screenId);
      const response = await fetch("/api/displays/revoke", { method: "POST", body: form });
      if (!response.ok && response.status !== 303) {
        setMessage("تعذر إلغاء جلسة الشاشة.");
        return;
      }
      window.location.reload();
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="section">
      {message ? <div className="notice" role="alert">{message}</div> : null}
      <div className="grid two-col">
        {displays.map((display) => {
          const code = codes[display.id];
          const expired = code ? new Date(code.expiresAt).getTime() <= nowMs : false;
          const remaining = code && !expired ? formatRemaining(code.expiresAt, nowMs) : null;
          return (
            <section className="card" key={display.id}>
              <div className="card-top">
                <div>
                  <span className="muted">{display.storeName}</span>
                  <strong>{display.name}</strong>
                </div>
                <span className="status">{labels[display.status] ?? display.status}</span>
              </div>
              <p className="hero-copy">الحالة: <strong>{labels[display.status] ?? display.status}</strong> · القالب: {display.template}</p>
              {code && !expired ? (
                <div className="notice" style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>رمز الاقتران — صالح لمدة 10 دقائق</div>
                  <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 8, margin: "6px 0" }}>{code.code}</div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>ينتهي خلال {remaining}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>أدخل الرمز في شاشة العرض، ثم سيُستهلك مرة واحدة.</div>
                </div>
              ) : code ? (
                <div className="notice" role="status">انتهت صلاحية الرمز. أنشئ رمزًا جديدًا عند الحاجة.</div>
              ) : null}
              <div className="actions" style={{ marginTop: 14 }}>
                <button className="btn primary" type="button" disabled={busy === display.id} onClick={() => generateCode(display.id)}>
                  {busy === display.id ? "جارٍ الإنشاء..." : expired || !code ? "إنشاء رمز اقتران" : "إعادة إنشاء الرمز"}
                </button>
                {display.status === "connected" ? (
                  <button className="btn ghost" type="button" disabled={busy === display.id} onClick={() => revoke(display.id)}>
                    إلغاء الجلسة
                  </button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {displays.length === 0 ? <section className="card"><p className="hero-copy">لا توجد شاشات بعد. أنشئ شاشة من مدير الحساب ثم استخدم رمز الاقتران هنا.</p></section> : null}
    </div>
  );
}
