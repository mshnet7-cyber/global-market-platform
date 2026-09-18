"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PwaNotificationPrompt from "../../PwaNotificationPrompt";
import PwaInstallPrompt from "../../PwaInstallPrompt";

type DocumentRow = {
  id: string;
  document_type: string | null;
  language: string | null;
  content_type: string | null;
  review_status: string | null;
  ai_confidence: number | null;
  created_at: string;
};
type BillingPlan = { id: string; code: string; name: string };
type BillingState = {
  integration?: { state?: string; provider?: string | null };
  subscription?: {
    plan_id: string;
    status: string;
    provider: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  plans?: BillingPlan[];
};

const planNames: Record<string, string> = { starter: "الشاشة", pro: "الأعمال", business: "الكاملة" };
const periods = [["monthly", "شهري"], ["six_month", "6 أشهر"], ["yearly", "سنوي"]] as const;

function printable(value: unknown) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

export default function Stage3Workspace({ documents, initialCountry, initialPlan, aiState, whatsappState, paymentState, einvoiceState }: { documents: DocumentRow[]; initialCountry: string; initialPlan?: string; aiState: string; whatsappState: string; paymentState: string; einvoiceState: string }) {
  const [tab, setTab] = useState("ai");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [documentId, setDocumentId] = useState(documents[0]?.id ?? "");
  const [ocrResult, setOcrResult] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [wa, setWa] = useState({ to: "", type: "template", template: "", text: "", documentUrl: "", parameters: "" });
  const [waResult, setWaResult] = useState("");
  const [waBusy, setWaBusy] = useState(false);
  const [billing, setBilling] = useState<BillingState>({});
  const [selectedPlan, setSelectedPlan] = useState(initialPlan && planNames[initialPlan] ? initialPlan : "starter");
  const [period, setPeriod] = useState("monthly");
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingResult, setBillingResult] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const [region, setRegion] = useState<any>(null);
  const [regionBusy, setRegionBusy] = useState(true);

  const selectedDocument = useMemo(() => documents.find((item) => item.id === documentId) ?? null, [documents, documentId]);


  useEffect(() => {
    let cancelled = false;
    fetch("/api/stage3/billing", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!cancelled && response.ok) {
          setBilling(data ?? {});
          const relation = data?.plans?.find((item: BillingPlan) => item.id === data?.subscription?.plan_id);
          if (relation) setSelectedPlan(relation.code);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stage3/regional?country=" + encodeURIComponent(country), { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!cancelled) setRegion(data?.data ?? null);
      })
      .catch(() => { if (!cancelled) setRegion(null); })
      ;
    return () => { cancelled = true; };
  }, [country]);

  async function runCopilot() {
    if (aiQuestion.trim().length < 2) return setAiResult("أدخل سؤالًا واضحًا.");
    setAiBusy(true); setAiResult("");
    try {
      const response = await fetch("/api/stage3/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "copilot", question: aiQuestion }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.integration_state === "integration_ready" ? "AI غير مفعّل بعد؛ الموصل جاهز بانتظار credentials." : data?.error || "تعذر تشغيل Copilot.");
      setAiResult(printable(data?.result));
    } catch (error) { setAiResult(error instanceof Error ? error.message : "تعذر تشغيل Copilot."); }
    finally { setAiBusy(false); }
  }

  async function runOcr() {
    if (!documentId) return setOcrResult("لا يوجد مستند متاح.");
    setOcrBusy(true); setOcrResult("");
    try {
      const response = await fetch("/api/stage3/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "ocr", document_id: documentId }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.integration_state === "integration_ready" ? "OCR غير مفعّل بعد؛ الموصل جاهز بانتظار credentials." : data?.error || "تعذر تشغيل OCR.");
      setOcrResult(printable(data?.result));
    } catch (error) { setOcrResult(error instanceof Error ? error.message : "تعذر تشغيل OCR."); }
    finally { setOcrBusy(false); }
  }

  async function sendWhatsApp() {
    if (!wa.to.trim()) return setWaResult("أدخل رقم المستلم.");
    setWaBusy(true); setWaResult("");
    try {
      const response = await fetch("/api/stage3/whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: wa.to,
          message_type: wa.type,
          template_name: wa.template,
          text: wa.text,
          document_url: wa.documentUrl,
          parameters: wa.parameters.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20)
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.integration_state === "integration_ready" ? "WhatsApp غير مفعّل بعد؛ الموصل جاهز بانتظار الاعتماد." : data?.error || "تعذر الإرسال.");
      setWaResult("تم إرسال الطلب إلى مزود WhatsApp.");
    } catch (error) { setWaResult(error instanceof Error ? error.message : "تعذر الإرسال."); }
    finally { setWaBusy(false); }
  }

  async function checkout() {
    setBillingBusy(true); setBillingResult("");
    try {
      const response = await fetch("/api/stage3/billing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan_code: selectedPlan, billing_period: period }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setBillingResult(data?.integration_state === "integration_ready" ? "الدفع Integration-ready فقط حاليًا؛ لا يبدأ Checkout قبل تفعيل المزود." : data?.error || "تعذر بدء الاشتراك.");
        return;
      }
      const url = data?.checkout?.url || data?.checkout?.checkout_url;
      if (typeof url === "string" && url.startsWith("https://")) window.location.assign(url);
      else setBillingResult("تم إنشاء جلسة الدفع ولم يُرجع المزود رابط Checkout قابلًا للمتابعة.");
    } catch (error) { setBillingResult(error instanceof Error ? error.message : "تعذر بدء الاشتراك."); }
    finally { setBillingBusy(false); }
  }

  const tabs = [["ai", "AI / OCR"], ["whatsapp", "WhatsApp"], ["billing", "Subscriptions"], ["einvoice", "E-Invoicing"], ["regional", "Globalization"], ["pwa", "PWA"]] as const;

  return (
    <>
      <nav className="stage3-tabs" aria-label="Stage 3">
        {tabs.map(([key, label]) => <button type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)} key={key}>{label}</button>)}
        <Link className="stage3-btn" href="/dashboard/api-keys">API Keys</Link>
      </nav>

      {tab === "ai" && <section className="stage3-grid">
        <article className="stage3-card">
          <div className="stage3-card-head"><h2>AI Copilot</h2><span className="stage3-status">{aiState}</span></div>
          <p>اسأل عن حالة تشغيل مؤسستك. البيانات تمر عبر سياق المؤسسة المرتبط بالحساب.</p>
          <textarea value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} rows={4} placeholder="مثال: كم عدد عمليات البيع المسجلة؟" />
          <div className="actions"><button type="button" className="stage3-btn stage3-btn-primary" disabled={aiBusy} onClick={() => void runCopilot()}>{aiBusy ? "جارٍ التحليل…" : "اسأل Copilot"}</button></div>
          {aiResult && <pre className="stage3-result" role="status">{aiResult}</pre>}
        </article>
        <article className="stage3-card">
          <div className="stage3-card-head"><h2>OCR</h2><span className="stage3-status">{selectedDocument?.review_status || "pending"}</span></div>
          <p>اختر مستندًا موجودًا داخل المؤسسة. النتيجة منخفضة الثقة تنتقل إلى needs_review.</p>
          {documents.length ? <><label className="stage3-field">المستند<select value={documentId} onChange={(event) => setDocumentId(event.target.value)}>{documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.document_type || "Document"} · {new Date(doc.created_at).toLocaleDateString()}</option>)}</select></label><div className="stage3-meta">{selectedDocument?.content_type || "—"} · {selectedDocument?.language || "—"}</div></> : <div className="stage3-empty">لا توجد مستندات جاهزة لمسار OCR.</div>}
          <div className="actions"><button type="button" className="stage3-btn stage3-btn-primary" disabled={ocrBusy || !documentId} onClick={() => void runOcr()}>{ocrBusy ? "جارٍ الاستخراج…" : "تشغيل OCR"}</button></div>
          {ocrResult && <pre className="stage3-result" role="status">{ocrResult}</pre>}
        </article>
      </section>}

      {tab === "whatsapp" && <section className="stage3-card">
        <div className="stage3-card-head"><h2>WhatsApp</h2><span className="stage3-status">{whatsappState}</span></div>
        <div className="stage3-form-grid">
          <label className="stage3-field">النوع<select value={wa.type} onChange={(event) => setWa({ ...wa, type: event.target.value })}><option value="template">Template</option><option value="text">Text</option><option value="document">Document</option></select></label>
          <label className="stage3-field">المستلم<input value={wa.to} onChange={(event) => setWa({ ...wa, to: event.target.value })} placeholder="+968..." /></label>
          <label className="stage3-field">اسم القالب<input value={wa.template} onChange={(event) => setWa({ ...wa, template: event.target.value })} /></label>
          <label className="stage3-field">رابط المستند<input value={wa.documentUrl} onChange={(event) => setWa({ ...wa, documentUrl: event.target.value })} /></label>
          <label className="stage3-field stage3-field-wide">المعاملات<input value={wa.parameters} onChange={(event) => setWa({ ...wa, parameters: event.target.value })} placeholder="value1, value2" /></label>
          <label className="stage3-field stage3-field-wide">النص<textarea rows={4} value={wa.text} onChange={(event) => setWa({ ...wa, text: event.target.value })} /></label>
        </div>
        <div className="actions"><button type="button" className="stage3-btn stage3-btn-primary" disabled={waBusy} onClick={() => void sendWhatsApp()}>{waBusy ? "جارٍ الإرسال…" : "إرسال"}</button></div>
        {waResult && <div className="stage3-result" role="status">{waResult}</div>}
      </section>}

      {tab === "billing" && <section className="stage3-grid">
        <article className="stage3-card">
          <div className="stage3-card-head"><h2>الاشتراك</h2><span className="stage3-status">{statusLabel(billing.subscription?.status || paymentState)}</span></div>
          <p>{billing.integration?.state === "live" ? "الدفع متصل." : "الدفع Integration-ready؛ لا يتم وصفه بأنه Live قبل التفعيل الفعلي."}</p>
          {billing.subscription ? <div className="stage3-kv"><div><span>Provider</span><b>{billing.subscription.provider || "—"}</b></div><div><span>ينتهي</span><b>{billing.subscription.current_period_end ? new Date(billing.subscription.current_period_end).toLocaleDateString() : "—"}</b></div><div><span>إلغاء بنهاية الفترة</span><b>{billing.subscription.cancel_at_period_end ? "نعم" : "لا"}</b></div></div> : <div className="stage3-empty">لا يوجد اشتراك محفوظ.</div>}
        </article>
        <article className="stage3-card">
          <div className="stage3-card-head"><h2>الباقة والفترة</h2><span className="stage3-status">{paymentState}</span></div>
          <div className="stage3-form-grid">
            <label className="stage3-field">الباقة<select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)}>{(billing.plans || [{id:"starter",code:"starter",name:"الشاشة"},{id:"pro",code:"pro",name:"الأعمال"},{id:"business",code:"business",name:"الكاملة"}]).map((plan) => <option key={plan.code} value={plan.code}>{planNames[plan.code] || plan.name}</option>)}</select></label>
            <label className="stage3-field">الفترة<select value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
          <div className="actions"><button type="button" className="stage3-btn stage3-btn-primary" disabled={billingBusy} onClick={() => void checkout()}>{billingBusy ? "جارٍ التجهيز…" : "متابعة الاشتراك"}</button><Link className="stage3-btn" href="/pricing">تفاصيل الباقات</Link></div>
          {billingResult && <div className="stage3-result" role="status">{billingResult}</div>}
        </article>
      </section>}

      {tab === "einvoice" && <section className="stage3-card"><div className="stage3-card-head"><h2>الفوترة الإلكترونية</h2><span className="stage3-status">{einvoiceState}</span></div><p>ملفات الدولة والطابور وحالات الفشل موجودة في مساحة الفوترة، مع فصل واضح بين المهيأ والموصل الرسمي المفعّل.</p><div className="actions"><Link className="stage3-btn stage3-btn-primary" href="/dashboard/invoicing">فتح مساحة الفوترة</Link></div></section>}

      {tab === "regional" && <section className="stage3-grid"><article className="stage3-card"><div className="stage3-card-head"><h2>Regional profile</h2><span className="stage3-status">{region === undefined ? "Loading" : region === null ? "Unavailable" : "Ready"}</span></div><label className="stage3-field">الدولة<select value={country} onChange={(event) => { setRegion(undefined); setCountry(event.target.value); }}><option value="OM">عُمان</option><option value="SA">السعودية</option><option value="AE">الإمارات</option></select></label>{region ? <div className="stage3-kv"><div><span>Locale</span><b>{region.locale || "—"}</b></div><div><span>Currency</span><b>{region.currency || "—"}</b></div><div><span>Timezone</span><b>{region.timezone || "—"}</b></div><div><span>Tax</span><b>{region.taxModel || "—"}</b></div><div><span>Direction</span><b>{region.direction || "—"}</b></div></div> : <div className="stage3-empty">تعذر تحميل الملف الإقليمي.</div>}</article><article className="stage3-card"><h2>Developer Platform</h2><p>التوثيق العام منفصل عن إدارة مفاتيح API. المفتاح الخام لا يُخزن.</p><div className="actions"><Link className="stage3-btn stage3-btn-primary" href="/dashboard/api-keys">إدارة المفاتيح</Link><Link className="stage3-btn" href="/developers">الوثائق</Link></div></article></section>}

      {tab === "pwa" && <section className="stage3-grid"><PwaInstallPrompt/><PwaNotificationPrompt/><article className="stage3-card"><div className="stage3-card-head"><h2>Offline safety</h2><span className="stage3-status live">Protected</span></div><p>الـService Worker يخزن shell/assets فقط، ولا يخزن مسارات API أو عمليات الدفع والبيع.</p></article></section>}
    </>
  );
}
