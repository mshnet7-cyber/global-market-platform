"use client";

import { useState } from "react";

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const scopeLabels: Record<string, string> = {
  "market:read": "قراءة السوق",
  "alerts:write": "كتابة التنبيهات",
  "webhooks:write": "كتابة Webhooks",
};

export default function ApiKeysWorkspace({ initialKeys }: { initialKeys: KeyRow[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["market:read"]);
  const [rawKey, setRawKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch("/api/v1/keys", { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (response.ok) setKeys(data?.keys ?? []);
  }

  async function createKey() {
    if (!name.trim() || scopes.length === 0) {
      setMessage("أدخل اسم المفتاح واختر صلاحية واحدة على الأقل.");
      return;
    }
    setBusy(true); setMessage(""); setRawKey("");
    try {
      const response = await fetch("/api/v1/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, scopes }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر إنشاء المفتاح.");
      setRawKey(String(data.key || ""));
      setName("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إنشاء المفتاح.");
    } finally { setBusy(false); }
  }

  async function revoke(id: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/v1/keys?id=" + encodeURIComponent(id), { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "تعذر إلغاء المفتاح.");
      setMessage("تم إلغاء المفتاح.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إلغاء المفتاح.");
    } finally { setBusy(false); }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(rawKey);
      setMessage("تم نسخ المفتاح.");
    } catch {
      setMessage("تعذر النسخ التلقائي. انسخ المفتاح يدويًا.");
    }
  }

  function toggleScope(scope: string) {
    setScopes((current) => current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]);
  }

  return (
    <section className="section">
      {message && <div className="notice" role="status">{message}</div>}
      {rawKey && (
        <article className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">المفتاح الجديد — يظهر الآن فقط</div>
          <p className="hero-copy">احفظه في مدير الأسرار لديك. لا يمكن استرجاع القيمة الكاملة لاحقًا.</p>
          <code className="api-key-value">{rawKey}</code>
          <div className="actions" style={{ marginTop: 12 }}><button type="button" className="btn primary" onClick={() => void copyKey()}>نسخ المفتاح</button></div>
        </article>
      )}

      <div className="grid two">
        <article className="card">
          <div className="card-title">إنشاء مفتاح</div>
          <label className="field" style={{ marginTop: 12 }}>اسم المفتاح<input value={name} onChange={(event) => setName(event.target.value)} placeholder="مثال: ERP integration" maxLength={80} /></label>
          <div className="field" style={{ marginTop: 12 }}><span>الصلاحيات</span>{Object.entries(scopeLabels).map(([scope, label]) => <label key={scope} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />{label}<small className="meta">{scope}</small></label>)}</div>
          <button type="button" className="btn primary" disabled={busy} style={{ marginTop: 14 }} onClick={() => void createKey()}>{busy ? "جارٍ التنفيذ…" : "إنشاء المفتاح"}</button>
        </article>

        <article className="card">
          <div className="card-title">المفاتيح الحالية</div>
          {keys.length === 0 ? <div className="empty-state" style={{ marginTop: 12 }}>لا توجد مفاتيح. أنشئ أول مفتاح للوصول البرمجي.</div> : keys.map((item) => (
            <div className="list-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <div className="meta">{item.key_prefix} · {(item.scopes || []).map((scope) => scopeLabels[scope] || scope).join("، ")}</div>
                <div className="meta">{item.revoked_at ? "ملغى" : item.last_used_at ? "آخر استخدام: " + new Date(item.last_used_at).toLocaleString() : "لم يُستخدم بعد"}</div>
              </div>
              {!item.revoked_at && <button type="button" className="btn" disabled={busy} onClick={() => void revoke(item.id)}>إلغاء</button>}
            </div>
          ))}
        </article>
      </div>
    </section>
  );
}
