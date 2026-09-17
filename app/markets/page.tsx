import { getSnapshot } from "../../lib/providers";
import { getPublicPriceHistory } from "../../lib/market-history";
import { appConfig, countries, isValidLanguage } from "../../lib/config";
import MarketTerminal from "./MarketTerminal";

export default async function MarketsPage({ searchParams }: { searchParams?: Promise<{ country?: string; language?: string; instrument?: string }> }) {
  const params = await searchParams;
  const language = params?.language && isValidLanguage(params.language) ? params.language.toLowerCase() : appConfig.defaultLanguage;
  const country = countries.find((c) => c.code === params?.country?.toUpperCase()) ?? countries.find((c) => c.code === appConfig.defaultCountry)!;
  const snapshot = await getSnapshot(country.currency, language, false, true);
  const requested = String(params?.instrument ?? "").toUpperCase();
  const firstQuote = snapshot.markets[0] ?? snapshot.stocks[0];
  const selected = requested || firstQuote?.symbol || firstQuote?.instrument || ("XAU" + country.currency);
  const history = await getPublicPriceHistory(selected, "1D");
  return <MarketTerminal
    language={language}
    countryCode={country.code}
    countryName={country.name}
    currency={country.currency}
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
  />;
}
