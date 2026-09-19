import Link from "next/link";
import { notFound } from "next/navigation";
import { countries, isValidLanguage } from "../../../lib/config";
import { getMessages, getDisplayName, isRtlLanguage } from "../../../lib/i18n";
import { getSnapshot } from "../../../lib/providers";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { formatMoneyDisplay } from "../../../lib/currency-display";

function formatMoney(value: number | null, locale: string, currency: string, maximumFractionDigits = 3) { return formatMoneyDisplay(value, currency, locale, maximumFractionDigits); }

export default async function StorePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams?: Promise<{ language?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  let store: any = null;
  let settings: any = null;
  let directory: any = null;

  if (admin) {
    const storeResult = await admin.from("gmp_stores").select("id,name,slug,phone,whatsapp,logo_path,country_code,currency,timezone").eq("slug", slug).maybeSingle();
    store = storeResult.data;
    if (store?.id) {
      const [settingsResult, directoryResult] = await Promise.all([
        admin.from("gmp_store_settings").select("language,template,orientation").eq("store_id", store.id).maybeSingle(),
        admin.from("gmp_store_directory").select("store_id,status").eq("store_id", store.id).eq("status","published").maybeSingle(),
      ]);
      settings = settingsResult.data;
      directory = directoryResult.data;
    }
  }

  if (!store || !directory) notFound();

  const country = countries.find((c) => c.code === String(store?.country_code ?? "OM").toUpperCase()) ?? countries.find((c) => c.code === "OM") ?? countries[0];
  const language = query?.language && isValidLanguage(query.language) ? query.language.toLowerCase() : String(settings?.language ?? "ar").toLowerCase();
  const messages = getMessages(language);
  const currency = String(store?.currency ?? country.currency).toUpperCase();
  const locale = `${language}-${country.code}`;
  const countryName = getDisplayName("region", country.code, language, country.name);
  const snapshot = await getSnapshot(currency, language, false);
  const gold = snapshot.gold;
  const title = store?.name ?? slug.replace(/[-_]+/g, " ");

  return <div className="page-frame store-page-public" dir={isRtlLanguage(language) ? "rtl" : "ltr"} lang={language}>
    <header className="topbar"><div className="container nav site-nav">
      <Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link>
      <nav className="nav-links" aria-label={language === "ar" ? "التنقل الرئيسي" : "Primary navigation"}>
        <Link href={"/gold?country=" + country.code + "&language=" + language}>{messages.gold}</Link>
        <Link href={"/silver?country=" + country.code + "&language=" + language}>{messages.silver}</Link>
        <Link href={"/markets?country=" + country.code + "&language=" + language}>{messages.markets}</Link>
        <Link href={"/stocks?country=" + country.code + "&language=" + language}>{messages.stocks}</Link>
        <Link href={"/currencies?country=" + country.code + "&language=" + language}>{messages.currencies}</Link>
        <Link href={"/news?country=" + country.code + "&language=" + language}>{messages.news}</Link>
        <Link href="/directory">{language === "ar" ? "المحلات" : "Stores"}</Link>
      </nav>
      <div className="nav-actions"><Link href="/login" className="btn btn-ghost">{messages.login}</Link><Link href="/pricing" className="btn btn-primary">{messages.plans}</Link></div>
    </div></header>
    <main className="store-page wrap section" lang={language}>
    <div className="eyebrow"><span className="live-dot" />{language === "ar" ? "مرجع المحل" : "STORE REFERENCE"}</div>
    <h1>{title}</h1>
    <p className="hero-copy">{messages.referenceOnly}</p><div className="meta store-reference-meta">{countryName} · {currency}</div>
    <section className="gold-card">
      <div className="card-top"><div><span className="muted">{countryName} · {currency}</span><strong>XAU/{currency}</strong></div><span className="status">{gold.status}</span></div>
      <div className="price">{formatMoney(gold.perGram24k, locale, currency, 3)} <small>/ غرام 24K</small></div>
      <div className="subline">{gold.provider} · {gold.timestamp ?? "—"}</div>
      <div className="mini-grid"><div><span>السعر الفوري</span><b>{formatMoney(gold.spot, locale, currency, 2)}</b></div><div><span>شراء</span><b>{formatMoney(gold.bid, locale, currency, 2)}</b></div><div><span>عرض</span><b>{formatMoney(gold.ask, locale, currency, 2)}</b></div></div>
    </section>
    <div className="actions" style={{marginTop:20}}><Link href="/demo" className="btn primary">{messages.createDisplay}</Link><Link href="/" className="btn ghost">{language === "ar" ? "الرئيسية" : "Home"}</Link></div>
  </main>
    <footer className="footer-premium"><div className="container footer-bottom"><span>© Global Market</span><span>{messages.referenceFooter}</span></div></footer>
  </div>;
}
