import { getSnapshot } from "../../lib/providers";
import { getPublicPriceHistory } from "../../lib/market-history";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import MarketTerminal from "../markets/MarketTerminal";

export default async function StocksPage({
  searchParams,
}: {
  searchParams?: Promise<{ country?: string; language?: string; instrument?: string }>;
}) {
  const params = await searchParams;
  const language = params?.language && isValidLanguage(params.language)
    ? params.language.toLowerCase()
    : appConfig.defaultLanguage;
  const country =
    countries.find((c) => c.code === params?.country?.toUpperCase()) ??
    countries.find((c) => c.code === appConfig.defaultCountry) ??
    countries[0];
  const snapshot = await getSnapshot(country.currency, language, false, true);
  const requested = String(params?.instrument ?? "").toUpperCase();
  const first = snapshot.stocks[0];
  const selected = requested || first?.symbol || first?.instrument || "AAPL";
  const history = await getPublicPriceHistory(selected, "1D");
  return (
    <MarketTerminal
      language={language}
      countryCode={country.code}
      countryName={country.name}
      currency={country.currency}
      focus="stocks"
      initial={{
        gold: snapshot.gold,
        silver: snapshot.silver,
        markets: snapshot.markets,
        stocks: snapshot.stocks,
        providers: snapshot.providers,
        generatedAt: snapshot.generatedAt,
        history,
        selectedInstrument: selected,
      }}
    />
  );
}
