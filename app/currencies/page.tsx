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

  return <div className="app-shell" lang={language} dir={isRtlLanguage(language) ? "rtl" : "ltr"}>
    <header className="topbar"><div className="container nav"><Link href="/" className="brand">GLOBAL <span>MARKET</span></Link><nav className="nav-links"><Link href={`/gold?country=${country.code}&language=${language}`}>{messages.gold}</Link><Link href={`/silver?country=${country.code}&language=${language}`}>{messages.silver}</Link><Link href={`/currencies?country=${country.code}&language=${language}`}>العملات</Link><Link href={`/news?country=${country.code}&language=${language}`}>{messages.news}</Link><Link href="/pricing">الاشتراكات</Link></nav><div className="nav-actions"><Link className="btn btn-ghost" href="/login">{messages.login}</Link><Link className="btn btn-primary" href="/demo">{messages.createDisplay}</Link></div></div></header>
    <main className="container section">
      <div className="kicker">FX REFERENCE</div>
      <h1>أسعار الصرف المرجعية</h1>
      <p className="hero-copy">1 وحدة من العملة الأساسية مقومة بعملة {countryName} ({country.currency}).</p>
      <div className="grid grid-4" style={{marginTop:24}}>{rates.map(({ base, rate }) => <section className="card" key={base}><div className="card-title">{base} → {country.currency}</div><div className="metric">{formatRate(rate, locale)}</div><div className="meta">مرجع صرف</div></section>)}</div>
      <div className="notice" style={{marginTop:24}}>هذه أسعار مرجعية وليست أسعار تحويل أو صرف ملزمة من بنك أو محل صرافة.</div>
    </main>
    <footer className="footer"><div className="container">{messages.referenceFooter}</div></footer>
  </div>;
}
