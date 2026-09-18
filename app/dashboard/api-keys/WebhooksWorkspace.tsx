"use client";

import { useEffect, useState } from "react";

type Endpoint = {
  id: string;
  url: string;
  event_types: string[];
  enabled: boolean;
  secret_hint: string | null;
  created_at: string;
};

export default function WebhooksWorkspace() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const response = await fetch("/api/dashboard/webhooks", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر تحميل Webhooks.");
      setEndpoints(data?.endpoints || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل Webhooks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function createEndpoint() {
    if (!url.trim() || secret.length < 16) {
      setMessage("أدخل رابط HTTPS وسر توقيع من 16 حرفًا على الأقل.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/dashboard/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, signing_secret: secret, event_types: ["market.alert.triggered"] }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر إنشاء Webhook.");
      setMessage("تم إنشاء Webhook. السر لا يُعرض مرة أخرى؛ الحفظ يتم مشفرًا.");
      setUrl("");
      setSecret("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إنشاء Webhook.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEndpoint(endpoint: Endpoint) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/dashboard/webhooks", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: endpoint.id, enabled: !endpoint.enabled }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر تحديث Webhook.");
      setEndpoints((current) => current.map((item) => item.id === endpoint.id ? { ...item, enabled: !item.enabled } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث Webhook.");
    } finally {
      setBusy(false);
    }
  }

  return <article className="card">
    <div className="card-title">Webhooks</div>
    <p className="hero-copy">إدارة endpoints التي تستقبل أحداث المنصة. الحدث المتاح حاليًا هو <code>market.alert.triggered</code>.</p>
    {message && <div className="notice" role="status">{message}</div>}
    <div className="grid two" style={{ marginTop: 12 }}>
      <div>
        <label className="label">رابط HTTPS<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/webhooks/gmp" /></label>
        <label className="label" style={{ marginTop: 10 }}>Signing secret<input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} autoComplete="new-password" placeholder="16+ characters" /></label>
        <button type="button" className="btn primary" style={{ marginTop: 12 }} disabled={busy} onClick={() => void createEndpoint()}>{busy ? "جارٍ الحفظ…" : "إضافة Webhook"}</button>
      </div>
      <div>
        {loading ? <div className="empty-state">جارٍ تحميل endpoints…</div> : endpoints.length === 0 ? <div className="empty-state">لا توجد endpoints مسجلة.</div> : endpoints.map((endpoint) => <div className="list-row" key={endpoint.id}><div><strong>{endpoint.url}</strong><div className="meta">{endpoint.enabled ? "مفعّل" : "معطّل"} · secret …{endpoint.secret_hint || "----"} · {endpoint.event_types.join("، ")}</div><div className="meta">أُنشئ {new Date(endpoint.created_at).toLocaleString("ar-OM")}</div></div><button type="button" className="btn" disabled={busy} onClick={() => void toggleEndpoint(endpoint)}>{endpoint.enabled ? "تعطيل" : "تفعيل"}</button></div>)}
      </div>
    </div>
  </article>;
}
