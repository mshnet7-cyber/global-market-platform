import Link from "next/link";
import { redirect } from "next/navigation";
import { getMerchantContext } from "../../../lib/merchant-access";
import { getAiStatus } from "../../../lib/stage3/ai";
import { getWhatsAppStatus } from "../../../lib/stage3/whatsapp";
import { getPaymentStatus } from "../../../lib/stage3/payments";
import { getEInvoiceStatus } from "../../../lib/stage3/einvoice";
import { getRegionalProfile } from "../../../lib/stage3/regional";
import Stage3Workspace from "./Stage3Workspace";

const label = (state: string) => state === "live" ? "مباشر" : state === "integration_ready" ? "جاهز للتكامل" : "غير مهيأ";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  const context = await getMerchantContext();
  if (!context.user || !context.organization) redirect("/login?next=/dashboard/integrations");
  const { supabase, organization, role, planCode } = context;

  const documentsResult = await supabase
    .from("gmp_documents")
    .select("id,document_type,language,content_type,review_status,ai_confidence,created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const ai = getAiStatus();
  const wa = getWhatsAppStatus();
  const pay = getPaymentStatus();
  const ei = getEInvoiceStatus();
  const region = getRegionalProfile(process.env.NEXT_PUBLIC_GMP_DEFAULT_COUNTRY || "OM");

  const cards = [
    ["المساعد الذكي + OCR", label(ai.state), ai.provider || "موصل", "Copilot والأسئلة التشغيلية واستخراج المستندات ومراجعة الثقة."],
    ["WhatsApp", label(wa.state), wa.provider || "موصل", "Templates، نصوص، مستندات، delivery status والتحقق من Webhook."],
    ["المدفوعات", label(pay.state), pay.provider || "موصل", "Checkout ودورة الاشتراك والفشل والفترة السماحية والإلغاء."],
    ["الفوترة الإلكترونية", label(ei.state), ei.provider || "موصل", "Validation والطابور والإرسال والتدقيق وإعادة المحاولة عند توفر الموصل الرسمي."],
    ["الإعدادات الإقليمية", "مباشر", region.countryCode, region.currency + " · " + region.timezone + " · " + region.locale],
    ["منصة المطورين", "مباشر", "API v2", "API keys، request IDs، rate limits، usage telemetry."],
  ];

  return (
    <main className="stage3-page">
      <div className="stage3-shell">
        <header className="stage3-header">
          <div>
            <div className="stage3-eyebrow">المرحلة 3 · التكاملات</div>
            <h1>طبقات التشغيل العليا داخل المنصة.</h1>
            <p>هذه الصفحة تربط واجهات Stage 3 بالوظائف الفعلية، مع فصل واضح بين Live وجاهز للتكامل.</p>
          </div>
          <div className="actions">
            <Link href="/dashboard" className="stage3-btn">لوحة التحكم</Link>
            <Link href="/developers" className="stage3-btn">وثائق API</Link>
          </div>
        </header>

        <section className="stage3-grid" aria-label="Integration status">
          {cards.map((card) => (
            <article className="stage3-card" key={card[0]}>
              <div className="stage3-card-head"><h2>{card[0]}</h2><span className={card[1] === "LIVE" ? "stage3-status live" : "stage3-status"}>{card[1]}</span></div>
              <strong>{card[2]}</strong>
              <p>{card[3]}</p>
            </article>
          ))}
        </section>

        <section className="stage3-panel">
          <div className="stage3-card-head"><h2>تشغيل Stage 3</h2><span className="stage3-status">{planCode || "لا توجد خطة فعالة"}</span></div>
          <p>الصلاحية الحالية: {role === "owner" ? "مالك" : role === "admin" ? "مدير" : "مشاهد"}. إجراءات AI وWhatsApp والفوترة الحساسة تتطلب المسار والصلاحية المناسبة.</p>
        </section>

        <Stage3Workspace
          documents={(documentsResult.data || []).map((doc) => ({
            id: String(doc.id),
            document_type: doc.document_type ? String(doc.document_type) : null,
            language: doc.language ? String(doc.language) : null,
            content_type: doc.content_type ? String(doc.content_type) : null,
            review_status: doc.review_status ? String(doc.review_status) : null,
            ai_confidence: doc.ai_confidence == null ? null : Number(doc.ai_confidence),
            created_at: String(doc.created_at),
          }))}
          initialCountry={region.countryCode}
          initialPlan={params.plan}
          aiState={ai.state}
          whatsappState={wa.state}
          paymentState={pay.state}
          einvoiceState={ei.state}
        />
      </div>
    </main>
  );
}
