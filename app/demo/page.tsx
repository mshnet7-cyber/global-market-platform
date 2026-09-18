import Link from "next/link";
import { getSnapshot } from "../../lib/providers";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import { getDisplayName, getMessages, isRtlLanguage } from "../../lib/i18n";
import { formatMoneyDisplay } from "../../lib/currency-display";

export default async function DemoPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string; language?: string }>;
}) {
  const params = await searchParams;
  const language =
    params?.language && isValidLanguage(params.language)
      ? params.language.toLowerCase()
      : appConfig.defaultLanguage;
  const country =
    countries.find((c) => c.code === params?.country?.toUpperCase()) ??
    countries.find((c) => c.code === appConfig.defaultCountry) ??
    countries[0];
  const messages = getMessages(language);
  const snapshot = await getSnapshot(country.currency, language, true, false);
  const rtl = isRtlLanguage(language);
  const locale = language + "-" + country.code;
  const countryName = getDisplayName("region", country.code, language, country.name);

  const money = (value: number | null | undefined, digits = 3) =>
    formatMoneyDisplay(value, country.currency, locale, digits);

  return (
    <div className="page-frame demo-page" dir={rtl ? "rtl" : "ltr"} lang={language}>
      <header className="topbar">
        <div className="container nav site-nav">
          <Link href="/" className="brand">
            <span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span>
          </Link>
          <nav className="nav-links" aria-label={language === "ar" ? "التنقل الرئيسي" : "Primary navigation"}>
            <Link href={"/gold?country=" + country.code + "&language=" + language}>{messages.gold}</Link>
            <Link href={"/silver?country=" + country.code + "&language=" + language}>{messages.silver}</Link>
            <Link href={"/markets?country=" + country.code + "&language=" + language}>{messages.markets}</Link>
            <Link href={"/stocks?country=" + country.code + "&language=" + language}>{messages.stocks}</Link>
            <Link href={"/news?country=" + country.code + "&language=" + language}>{messages.news}</Link>
            <Link href="/pricing">{messages.plans}</Link>
          </nav>
          <div className="nav-actions">
            <Link className="btn btn-ghost" href="/login">{messages.login}</Link>
            <Link className="btn btn-primary" href="/signup">{messages.signup}</Link>
          </div>
        </div>
      </header>

      <main className="container demo-main">
        <section className="demo-hero">
          <div>
            <div className="eyebrow"><span className="live-dot" />{language === "ar" ? "معاينة شاشة السوق" : "MARKET DISPLAY PREVIEW"}</div>
            <h1>{language === "ar" ? "شاشة أسعار تليق بواجهة المحل." : "A market display designed for the shop floor."}</h1>
            <p>{messages.demoPreview}</p>
            <div className="actions">
              <Link href="/pricing" className="btn btn-primary btn-lg">{messages.plans}</Link>
              <Link href="/login" className="btn btn-lg">{messages.login}</Link>
            </div>
          </div>
          <div className="demo-context">
            <span>{countryName}</span>
            <strong>{country.currency}</strong>
            <small>{language.toUpperCase()} · {language === "ar" ? "بيانات معاينة" : "Preview data"}</small>
          </div>
        </section>

        <section className="demo-screen" aria-label={language === "ar" ? "معاينة الشاشة" : "Display preview"}>
          <div className="demo-screen-top">
            <div><span className="micro-label">{language === "ar" ? "السوق العالمي" : "GLOBAL MARKET"}</span><strong>{countryName}</strong></div>
            <span className="status">{snapshot.gold.status}</span>
          </div>
          <div className="demo-screen-primary">
            <span>{language === "ar" ? "الذهب 24K" : "GOLD 24K"}</span>
            <strong>{money(snapshot.gold.perGram24k)}</strong>
            <small>{language === "ar" ? "للغرام" : "per gram"} · {country.currency}</small>
          </div>
          <div className="demo-screen-grid">
            <div><span>{language === "ar" ? "الفضة 999" : "SILVER 999"}</span><strong>{money(snapshot.silver.perGram24k)}</strong></div>
            <div><span>{messages.bid}</span><strong>{money(snapshot.gold.bid, 2)}</strong></div>
            <div><span>{messages.ask}</span><strong>{money(snapshot.gold.ask, 2)}</strong></div>
            <div><span>{language === "ar" ? "المصدر" : "SOURCE"}</span><strong>{snapshot.gold.provider || messages.unavailable}</strong></div>
          </div>
          <div className="demo-screen-footer">{messages.referenceOnly} · {messages.referenceFooter}</div>
        </section>
      </main>

      <footer className="footer-premium">
        <div className="container footer-bottom"><span>© Global Market</span><span>{messages.referenceFooter}</span></div>
      </footer>
    </div>
  );
}
