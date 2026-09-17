import { getSnapshot } from "../../lib/providers";
import { getPublicPriceHistory } from "../../lib/market-history";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import GoldIntelligence from "./GoldIntelligence";

export default async function GoldPage({ searchParams }: { searchParams?: Promise<{ country?: string; language?: string; currency?: string }> }) {
  const params = await searchParams;
  const language = params?.language && isValidLanguage(params.language) ? params.language.toLowerCase() : appConfig.defaultLanguage;
  const country = countries.find((c) => c.code === params?.country?.toUpperCase()) ?? countries.find((c) => c.code === appConfig.defaultCountry)!;
  const requestedCurrency = String(params?.currency ?? "").toUpperCase();
  const currency = /^[A-Z]{3}$/.test(requestedCurrency) ? requestedCurrency : country.currency;
  const snapshot = await getSnapshot(currency, language, false, false);
  const history = await getPublicPriceHistory("XAU" + currency, "1D");
  return <GoldIntelligence language={language} countryCode={country.code} countryName={country.name} currency={currency} gold={snapshot.gold} silver={snapshot.silver} history={history} />;
}
