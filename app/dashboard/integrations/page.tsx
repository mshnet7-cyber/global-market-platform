import Link from "next/link";
import { getAiStatus } from "../../../lib/stage3/ai";
import { getWhatsAppStatus } from "../../../lib/stage3/whatsapp";
import { getPaymentStatus } from "../../../lib/stage3/payments";
import { getEInvoiceStatus } from "../../../lib/stage3/einvoice";
import { getRegionalProfile } from "../../../lib/stage3/regional";

function stateLabel(state: string) {
  if (state === "live") return "LIVE";
  if (state === "integration_ready") return "INTEGRATION-READY";
  return "NOT CONFIGURED";
}

export default function IntegrationsPage() {
  const ai = getAiStatus();
  const whatsapp = getWhatsAppStatus();
  const payments = getPaymentStatus();
  const einvoice = getEInvoiceStatus();
  const region = getRegionalProfile(process.env.NEXT_PUBLIC_GMP_DEFAULT_COUNTRY || "OM");
  const cards = [
    ["AI Copilot + OCR", stateLabel(ai.state), ai.provider || "Adapter layer", "OCR, extraction, review, operational copilot"],
    ["WhatsApp", stateLabel(whatsapp.state), whatsapp.provider || "Provider adapter", "Templates, delivery status, retries, webhook verification"],
    ["Payments", stateLabel(payments.state), payments.provider || "Provider adapter", "Checkout, subscriptions, renewal, failure, grace, cancellation"],
    ["E-Invoicing", stateLabel(einvoice.state), einvoice.provider || "Government/provider adapter", "Validation, submission, acknowledgement, retry, audit"],
    ["Globalization", "LIVE", region.countryCode, `${region.currency} · ${region.timezone} · ${region.locale}`],
    ["Developer Platform", "LIVE", "API v2", "Request IDs, API-key auth, rate limits, usage telemetry"],
  ];
  return (
    <main className="stage3-page">
      <div className="stage3-shell">
        <header className="stage3-header">
          <div>
            <div className="stage3-eyebrow">STAGE 3 · INTEGRATIONS</div>
            <h1>طبقات التشغيل العليا داخل المنصة.</h1>
            <p>الـAI والدفع وواتساب والفوترة الإلكترونية وطبقة المطورين تعمل من نفس البنية، مع فصل واضح بين Live وIntegration-ready.</p>
          </div>
          <Link href="/dashboard/operations" className="stage3-btn">العودة إلى التشغيل</Link>
        </header>
        <section className="stage3-grid">
          {cards.map(([name,state,provider,detail]) => (
            <article className="stage3-card" key={name}>
              <div className="stage3-card-head"><h2>{name}</h2><span className={state === "LIVE" ? "stage3-status live" : "stage3-status"}>{state}</span></div>
              <strong>{provider}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </section>
        <section className="stage3-panel">
          <h2>حماية مسار التشغيل</h2>
          <p>الـoffline mode لا يخزن عمليات البيع أو الدفع أو بيانات API الخاصة. بيانات السوق العامة فقط يمكن عرضها من cache محلي. الأسرار تبقى في environment secrets ولا تُسجّل في audit أو logs.</p>
        </section>
      </div>
    </main>
  );
}
