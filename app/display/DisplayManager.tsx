"use client";

import { useState } from "react";

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

export default function DisplayManager({ displays }: { displays: DisplayItem[] }) {
  const [codes, setCodes] = useState<Record<string, { code: string; expiresAt: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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
      setCodes((current) => ({ ...current, [screenId]: { code: data.code, expiresAt: data.expires_at } }));
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
          return (
            <section className="card" key={display.id}>
              <div className="eyebrow">{display.storeName}</div>
              <h2>{display.name}</h2>
              <p className="hero-copy">الحالة: <strong>{labels[display.status] ?? display.status}</strong> · القالب: {display.template}</p>
              {code ? (
                <div className="notice" style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>رمز الاقتران — صالح لمدة 10 دقائق</div>
                  <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: 8, margin: "6px 0" }}>{code.code}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>أدخل هذا الرمز في شاشة العرض، ثم سيُستهلك مرة واحدة.</div>
                </div>
              ) : null}
              <div className="actions" style={{ marginTop: 14 }}>
                <button className="btn primary" type="button" disabled={busy === display.id} onClick={() => generateCode(display.id)}>
                  {busy === display.id ? "جارٍ الإنشاء..." : "إنشاء رمز اقتران"}
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
