import Link from "next/link";
import { fetchFrankfurterRate } from "../../lib/free-data";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import { getDisplayName, getMessages, isRtlLanguage } from "../../lib/i18n";

const BASES = ["USD", "EUR", "GBP", "AED", "SAR", "INR", "PKR", "BHD"] as const;

function formatRate(value: number | null, locale: string) {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 6 });
}

export default async function CurrenciesPage({ searchParams }: { searchParams?: Promise<{ country?: string; language?: string }> }) {
  const params = await searchParams;
  const country = countries.find((c) => c.code === params?.country?.toUpperCase()) ?? countries.find((c) => c.code === appConfig.defaultCountry) ?? countries[0];
  const language = params?.language && isValidLanguage(params.language) ? params.language.toLowerCase() : appConfig.defaultLanguage;
  const messages = getMessages(language);
  const locale = `${language}-${country.code}`;
  const rates = await Promise.all(BASES.map(async (base) => ({ base, rate: await fetchFrankfurterRate(base, country.currency) })));
  const countryName = getDisplayName("region", country.code, language, country.name);

  return <div className="app-shell currency-page" lang={language} dir={isRtlLanguage(language) ? "rtl" : "ltr"}>
    <header className="topbar"><div className="container nav site-nav"><Link href="/" className="brand"><span className="brand-mark">GM</span><span>GLOBAL <b>MARKET</b></span></Link><nav className="nav-links" aria-label="Primary"><Link href={`/gold?country=${country.code}&language=${language}`}>{messages.gold}</Link><Link href={`/silver?country=${country.code}&language=${language}`}>{messages.silver}</Link><Link href={`/markets?country=${country.code}&language=${language}`}>{messages.markets}</Link><Link href={`/stocks?country=${country.code}&language=${language}`}>{messages.stocks}</Link><Link href={`/currencies?country=${country.code}&language=${language}`}>{messages.currencies}</Link><Link href={`/news?country=${country.code}&language=${language}`}>{messages.news}</Link></nav><div className="nav-actions"><div className="nav-preferences"><span className="country-dot" />{countryName}<span className="nav-divider" />{language.toUpperCase()}</div><Link className="btn btn-ghost" href="/login">{messages.login}</Link><Link className="btn btn-primary" href="/demo">{messages.createDisplay}</Link></div></div></header>
    <main className="container section">
      <div className="kicker">FX REFERENCE</div>
      <h1>{messages.currencies} · {language === "ar" ? "أسعار الصرف المرجعية" : language === "tr" ? "Referans döviz kurları" : language === "de" ? "Referenz-Wechselkurse" : "Reference exchange rates"}</h1>
      <p className="hero-copy">{language === "ar" ? "1 وحدة من العملة الأساسية مقومة بعملة" : language === "tr" ? "1 temel para birimi" : language === "de" ? "1 Einheit der Basiswährung" : "1 unit of the base currency"} {countryName} ({country.currency}).</p>
      <div className="grid grid-4 currency-grid">{rates.map(({ base, rate }) => <section className="card" key={base}><div className="card-title">{base} <span className="rate-arrow">→</span> {country.currency}</div><div className="metric">{formatRate(rate, locale)}</div><div className="meta">{language === "ar" ? "مرجع صرف" : language === "tr" ? "Referans kur" : language === "de" ? "Referenzkurs" : "Reference rate"}</div></section>)}</div>
      <div className="notice currency-notice">{language === "ar" ? "هذه أسعار مرجعية وليست أسعار تحويل أو صرف ملزمة من بنك أو محل صرافة." : language === "tr" ? "Bunlar referans kurlardır; banka veya döviz bürosu işlemi için bağlayıcı değildir." : language === "de" ? "Dies sind Referenzkurse und keine verbindlichen Umtausch- oder Kassenkurse." : "These are reference rates, not binding bank or exchange-house transaction rates."}</div>
    </main>
    <footer className="footer-premium"><div className="container footer-bottom"><span>© Global Market</span><span>{messages.referenceFooter}</span></div></footer>
  </div>;
}
