import Link from "next/link";
import { fetchFrankfurterRate } from "../../lib/free-data";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import { getDisplayName, getMessages, isRtlLanguage } from "../../lib/i18n";

const BASES = ["USD", "EUR", "GBP", "AED", "SAR", "INR", "PKR", "BHD"] as const;

function formatRate(value: number | null, locale: string) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 6 });
}

export default async function CurrenciesPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string; language?: string }>;
}) {
  const params = await searchParams;
  const country =
    countries.find((c) => c.code === params?.country?.toUpperCase()) ??
    countries.find((c) => c.code === appConfig.defaultCountry) ??
    countries[0];
  const language =
    params?.language && isValidLanguage(params.language)
      ? params.language.toLowerCase()
      : appConfig.defaultLanguage;
  const messages = getMessages(language);
  const locale = language + "-" + country.code;
  const rates = await Promise.all(BASES.map(async (base) => ({
    base,
    rate: await fetchFrankfurterRate(base, country.currency),
  })));
  const countryName = getDisplayName("region", country.code, language, country.name);

  return (
    <div className="page-frame section-page section-currencies" lang={language} dir={isRtlLanguage(language) ? "rtl" : "ltr"}>
      <header className="topbar">
        <div className="container nav site-nav">
          <Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link>
          <nav className="nav-links" aria-label={language === "ar" ? "التنقل الرئيسي" : "Primary navigation"}>
            <Link href={"/gold?country=" + country.code + "&language=" + language}>{messages.gold}</Link>
            <Link href={"/silver?country=" + country.code + "&language=" + language}>{messages.silver}</Link>
            <Link href={"/markets?country=" + country.code + "&language=" + language}>{messages.markets}</Link>
            <Link href={"/stocks?country=" + country.code + "&language=" + language}>{messages.stocks}</Link>
            <Link href={"/currencies?country=" + country.code + "&language=" + language}>{messages.currencies}</Link>
            <Link href={"/news?country=" + country.code + "&language=" + language}>{messages.news}</Link>
          </nav>
          <div className="nav-actions">
            <div className="nav-preferences"><span className="country-dot" />{countryName}<span className="nav-divider" />{language.toUpperCase()}</div>
            <Link href="/login" className="btn btn-ghost">{messages.login}</Link>
            <Link href="/pricing" className="btn btn-primary">{messages.plans}</Link>
          </div>
        </div>
      </header>

      <main className="container site-main section-shell">
        <section className="page-hero">
          <div className="section-header">
            <div>
              <div className="eyebrow"><span className="live-dot" />مرجع العملات · {countryName}</div>
              <h1>{messages.currencies}</h1>
            </div>
            <div className="meta-block">
              {language === "ar"
                ? "أسعار صرف مرجعية للعملة المحلية، مع توضيح المصدر وطبيعة البيانات."
                : "Reference exchange rates for the selected local currency, with source-aware labeling."}
            </div>
          </div>
        </section>

        <section className="hero-panel currency-hero-panel">
          <div>
            <div className="micro-label">{language === "ar" ? "العملة المستهدفة" : "Target currency"}</div>
            <div className="panel-value">{country.currency}</div>
            <div className="panel-meta">{countryName}</div>
          </div>
          <div className="notice currency-notice">
            {language === "ar"
              ? "الأسعار مرجعية وليست أسعار تحويل أو صرف ملزمة من بنك أو محل صرافة."
              : "Reference rates only; not binding bank or exchange-house transaction rates."}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <div className="eyebrow">جدول مرجعي</div>
              <h2>{language === "ar" ? "العملات الأساسية" : "Base currencies"}</h2>
            </div>
            <span className="meta">{BASES.length} {language === "ar" ? "عملات" : "currencies"}</span>
          </div>
          <div className="grid grid-4 currency-grid">
            {rates.map(({ base, rate }) => (
              <article className="card" key={base}>
                <div className="card-top">
                  <div className="card-title">{base}</div>
                  <span className="status">{rate == null ? messages.statusUnavailable : "مرجعي"}</span>
                </div>
                <div className="metric">{formatRate(rate, locale)}</div>
                <div className="meta">1 {base} → {country.currency}</div>
              </article>
            ))}
          </div>
        </section>

        <div className="terminal-footnote">
          {language === "ar"
            ? "المصدر المرجعي يعرض سعرًا واحدًا لكل زوج حسب البيانات المتاحة وقت الطلب."
            : "The reference source provides one rate per pair based on data available at request time."}
        </div>
      </main>

      <footer className="footer-premium">
        <div className="container footer-bottom"><span>© Global Market</span><span>{messages.referenceFooter}</span></div>
      </footer>
    </div>
  );
}
