import { NextResponse } from "next/server";
import { appConfig, countries, isValidLanguage } from "../../../../lib/config";
import { getSnapshot } from "../../../../lib/providers";
import { getPublicPriceHistory, HISTORY_RANGES, isPublicHistoryInstrument } from "../../../../lib/market-history";
import { withTrustStatus } from "../../../../lib/market-trust";

export async function GET(request: Request) {
  const url=new URL(request.url);
  const languageParam=url.searchParams.get("language")?.toLowerCase() ?? appConfig.defaultLanguage;
  const language=isValidLanguage(languageParam)?languageParam:appConfig.defaultLanguage;
  const countryCode=url.searchParams.get("country")?.toUpperCase() ?? appConfig.defaultCountry;
  const country=countries.find(c=>c.code===countryCode)||countries.find(c=>c.code===appConfig.defaultCountry)!;
  const snapshot=await getSnapshot(country.currency,language,false,true);
  const requested=url.searchParams.get("instrument")?.trim().toUpperCase();
  const range=(url.searchParams.get("range") ?? "1D") as keyof typeof HISTORY_RANGES;
  const validRange=Object.prototype.hasOwnProperty.call(HISTORY_RANGES,range)?range:"1D";
  const allQuotes=[...snapshot.markets,...snapshot.stocks].map(withTrustStatus);
  const selected=requested||("XAU"+country.currency);
  if(!isPublicHistoryInstrument(selected)) return NextResponse.json({error:"instrument_not_public"},{status:400,headers:{"cache-control":"no-store"}});
  const isGold=selected===("XAU"+country.currency)||selected==="XAUOMR"||selected==="XAUUSD";
  const selectedQuote=allQuotes.find(q=>q.symbol===selected||q.instrument===selected)||null;
  const history=await getPublicPriceHistory(selected,validRange);
  return NextResponse.json({
    gold:snapshot.gold,
    silver:snapshot.silver,
    markets:allQuotes.filter(q=>snapshot.markets.some(m=>(m.symbol??m.instrument)===(q.symbol??q.instrument))),
    stocks:allQuotes.filter(q=>snapshot.stocks.some(m=>(m.symbol??m.instrument)===(q.symbol??q.instrument))),
    providers:snapshot.providers,
    generatedAt:snapshot.generatedAt,
    history,
    selectedInstrument:isGold?("XAU"+country.currency):(selectedQuote?.symbol??selected),
  },{headers:{"cache-control":"no-store"}});
}
