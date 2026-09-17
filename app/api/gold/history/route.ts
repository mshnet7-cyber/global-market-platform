import { NextResponse } from "next/server";
import { getPublicPriceHistory, HISTORY_RANGES } from "../../../../lib/market-history";

export async function GET(request: Request) {
  const url=new URL(request.url);
  const instrument=String(url.searchParams.get("instrument")??"XAUOMR").toUpperCase();
  if(!/^[A-Z0-9_.:/-]{2,40}$/.test(instrument)) return NextResponse.json({error:"invalid_instrument"},{status:400});
  const range=(url.searchParams.get("range")??"1D") as keyof typeof HISTORY_RANGES;
  const validRange=Object.prototype.hasOwnProperty.call(HISTORY_RANGES,range)?range:"1D";
  return NextResponse.json({instrument,range,points:await getPublicPriceHistory(instrument,validRange)},{headers:{"cache-control":"no-store"}});
}
