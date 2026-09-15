import Link from "next/link";
import { countries, isValidLanguage } from "../../../lib/config";
import { getMessages, getDisplayName, isRtlLanguage } from "../../../lib/i18n";
import { getSnapshot } from "../../../lib/providers";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

function formatMoney(value: number | null, locale: string, currency: string, maximumFractionDigits = 3) {
  if (value == null || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits }).format(value);
  } catch {
    return `${value.toLocaleString(locale, { maximumFractionDigits })} ${currency}`;
  }
}

export default async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ language?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  let store: any = null;

  if (admin) {
    const { data } = await admin.from("gmp_stores").select("id,name,slug,phone,whatsapp,logo_path,country_code,currency,timezone,gmp_store_settings: gmp_store_settings!store_settings_store_id_fkey(language,template,orientation)").eq("slug", slug).maybeSingle();
    store = data;
  }

  const country = countries.find((c) => c.code === String(store?.country_code ?? "OM").toUpperCase()) ?? countries.find((c) => c.code === "OM") ?? countries[0];
  const language = query?.language && isValidLanguage(query.language) ? query.language.toLowerCase() : String(store?.gmp_store_settings?.language ?? "ar").toLowerCase();
  const messages = getMessages(language);
  const locale = `${language}-${country.code}`;
  const countryName = getDisplayName("region", country.code, language, country.name);
  const snapshot = await getSnapshot(String(store?.currency ?? country.currency), language, false);
  const gold = snapshot.gold;
  const title = store?.name ?? slug.replace(/[-_]+/g, " ");

  return <main className="wrap section" dir={isRtlLanguage(language) ? "rtl" : "ltr"} lang={language}>
    <div className="eyebrow">STORE REFERENCE PAGE</div>
    <h1>{title}</h1>
    <p className="hero-copy">{messages.referenceOnly}</p>
    <section className="gold-card">
      <div className="card-top"><div><span className="muted">{countryName} · {store?.currency ?? country.currency}</span><strong>XAU/USD</strong></div><span className="status">{gold.status}</span></div>
      <div className="price">{formatMoney(gold.perGram24k, locale, String(store?.currency ?? country.currency), 3)} <small>/ gram 24K</small></div>
      <div className="subline">{gold.provider} · {gold.timestamp ?? "—"}</div>
      <div className="mini-grid"><div><span>Spot</span><b>{formatMoney(gold.spot, locale, String(store?.currency ?? country.currency), 2)}</b></div><div><span>Bid</span><b>{formatMoney(gold.bid, locale, String(store?.currency ?? country.currency), 2)}</b></div><div><span>Ask</span><b>{formatMoney(gold.ask, locale, String(store?.currency ?? country.currency), 2)}</b></div></div>
    </section>
    <div className="actions" style={{marginTop:20}}><Link href="/demo" className="btn primary">{messages.createDisplay}</Link><Link href="/" className="btn ghost">{language === "ar" ? "الرئيسية" : "Home"}</Link></div>
  </main>;
}
