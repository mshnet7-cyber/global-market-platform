import { getSnapshot } from "../../lib/providers";
import { getPublicPriceHistory } from "../../lib/market-history";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import SilverIntelligence from "./SilverIntelligence";

export default async function SilverPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string; language?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const language = params?.language && isValidLanguage(params.language)
    ? params.language.toLowerCase()
    : appConfig.defaultLanguage;
  const country =
    countries.find((c) => c.code === params?.country?.toUpperCase()) ??
    countries.find((c) => c.code === appConfig.defaultCountry) ??
    countries[0];
  const requestedCurrency = String(params?.currency ?? "").toUpperCase();
  const currency = /^[A-Z]{3}$/.test(requestedCurrency) ? requestedCurrency : country.currency;
  const snapshot = await getSnapshot(currency, language, false, false);
  const history = await getPublicPriceHistory("XAG" + currency, "1D");

  return (
    <SilverIntelligence
      language={language}
      countryCode={country.code}
      countryName={country.name}
      currency={currency}
      silver={snapshot.silver}
      history={history}
    />
  );
}
