import Link from "next/link";
import { getSnapshot } from "../../lib/providers";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import { getDisplayName, getMessages, isRtlLanguage, formatStatus } from "../../lib/i18n";

export default async function NewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string; language?: string }>;
}) {
  const params = await searchParams;
  const language = params?.language && isValidLanguage(params.language)
    ? params.language.toLowerCase()
    : appConfig.defaultLanguage;
  const country =
    countries.find((c) => c.code === params?.country?.toUpperCase()) ??
    countries.find((c) => c.code === appConfig.defaultCountry) ??
    countries[0];
  const messages = getMessages(language);
  const snapshot = await getSnapshot(country.currency, language, false, false);
  const countryName = getDisplayName("region", country.code, language, country.name);
  const locale = language + "-" + country.code;

  return (
    <div className="page-frame section-page section-news" dir={isRtlLanguage(language) ? "rtl" : "ltr"} lang={language}>
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
              <div className="eyebrow"><span className="live-dot" />NEWSROOM · {countryName}</div>
              <h1>{messages.news}</h1>
            </div>
            <div className="meta-block">
              {language === "ar"
                ? "موجز الأخبار المتاحة من مصادر البيانات المفعّلة، مع المصدر والحالة ووقت النشر."
                : "Available market news with source, status and publication time."}
            </div>
          </div>
        </section>

        {snapshot.news.length === 0 ? (
          <div className="empty-premium" role="status">{messages.noNews}</div>
        ) : (
          <section className="news-grid" aria-label={language === "ar" ? "الأخبار" : "News"}>
            {snapshot.news.map((item) => (
              <article className="news-card" key={item.id}>
                <div className="card-top">
                  <span className="status">{formatStatus(item.status, messages)}</span>
                  <span className="muted">{item.category}</span>
                </div>
                <h2>{item.title}</h2>
                <div className="meta">{item.source} · {new Date(item.publishedAt).toLocaleString(locale)}</div>
                <div className="actions" style={{ marginTop: 16 }}>
                  {item.url && item.url !== "#" ? (
                    <a className="btn btn-primary" href={item.url} target="_blank" rel="noreferrer">{language === "ar" ? "فتح الخبر" : "Open article"}</a>
                  ) : (
                    <span className="btn" aria-disabled="true">{language === "ar" ? "الرابط غير متاح" : "Source link unavailable"}</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      <footer className="footer-premium">
        <div className="container footer-bottom"><span>© Global Market</span><span>{messages.referenceFooter}</span></div>
      </footer>
    </div>
  );
}
