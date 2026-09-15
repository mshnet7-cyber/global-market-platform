export const appConfig = {
  name: "Global Market Platform",
  defaultCountry: "OM",
  defaultCurrency: "OMR",
  defaultLanguage: "ar",
} as const;

const ISO_COUNTRY_CODES = ['AW','AF','AO','AI','AX','AL','AD','AE','AR','AM','AS','AQ','TF','AG','AU','AT','AZ','BI','BE','BJ','BQ','BF','BD','BG','BH','BS','BA','BL','BY','BZ','BM','BO','BR','BB','BN','BT','BV','BW','CF','CA','CC','CH','CL','CN','CI','CM','CD','CG','CK','CO','KM','CV','CR','CU','CW','CX','KY','CY','CZ','DE','DJ','DM','DK','DO','DZ','EC','EG','ER','EH','ES','EE','ET','FI','FJ','FK','FR','FO','FM','GA','GB','GE','GG','GH','GI','GN','GP','GM','GW','GQ','GR','GD','GL','GT','GF','GU','GY','HK','HM','HN','HR','HT','HU','ID','IM','IN','IO','IE','IR','IQ','IS','IL','IT','JM','JE','JO','JP','KZ','KE','KG','KH','KI','KN','KR','KW','LA','LV','LB','LR','LY','LC','LI','LK','LS','LT','LU','MC','MO','MF','MA','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NC','NE','NF','NG','NI','NU','NL','NO','NP','NR','NZ','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU','VE','VG','VI','VN','WF','EH','YE','ZM','ZW'];

const ISO_LANGUAGE_CODES = ['aa','ab','af','ak','am','an','ar','as','av','ay','az','ba','be','bg','bh','bi','bm','bn','bo','br','bs','ca','ce','ch','co','cr','cs','cu','cv','cy','da','de','dv','dz','ee','el','en','eo','es','et','eu','fa','ff','fi','fj','fo','fr','fy','ga','gd','gl','gn','gu','gv','ha','he','hi','ho','hr','ht','hu','hy','hz','ia','id','ie','ig','ii','ik','io','is','it','iu','ja','jv','ka','kg','ki','kj','kk','kl','km','kn','ko','kr','ks','ku','kv','kw','ky','la','lb','lg','li','ln','lo','lt','lu','lv','mg','mh','mi','mk','ml','mn','mr','ms','mt','my','na','nb','nd','ne','ng','nl','nn','no','nr','nv','ny','oc','oj','om','or','os','pa','pi','pl','ps','pt','qu','rm','rn','ro','ru','rw','sa','sc','sd','se','sg','si','sk','sl','sm','sn','so','sq','sr','ss','st','su','sv','sw','ta','te','tg','th','ti','tk','tl','tn','to','tr','ts','tt','tw','ty','ug','uk','ur','uz','ve','vi','vo','wa','wo','xh','yi','yo','za','zh','zu'];

export type CountryCode = (typeof ISO_COUNTRY_CODES)[number];
export type LanguageCode = (typeof ISO_LANGUAGE_CODES)[number];

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

const defaultCurrencyByCountry: Record<string, string> = {
  OM:"OMR",SA:"SAR",AE:"AED",US:"USD",GB:"GBP",TR:"TRY",DE:"EUR",JP:"JPY",CN:"CNY",IN:"INR",CH:"CHF",CA:"CAD",AU:"AUD",NZ:"NZD",SG:"SGD",HK:"HKD",QA:"QAR",KW:"KWD",BH:"BHD",JO:"JOD",EG:"EGP",MA:"MAD",ZA:"ZAR",NG:"NGN",BR:"BRL",MX:"MXN",AR:"ARS",CL:"CLP",CO:"COP",PE:"PEN",RU:"RUB",UA:"UAH",PL:"PLN",SE:"SEK",NO:"NOK",DK:"DKK",IS:"ISK",CZ:"CZK",HU:"HUF",RO:"RON",BG:"BGN",RS:"RSD",IL:"ILS",TH:"THB",ID:"IDR",MY:"MYR",KR:"KRW",PK:"PKR",BD:"BDT",LK:"LKR",NP:"NPR",VN:"VND",PH:"PHP",KZ:"KZT",AZ:"AZN",GE:"GEL",AM:"AMD",UZ:"UZS",AZ:"AZN",IR:"IRR",IQ:"IQD",SY:"SYP",YE:"YER",LB:"LBP",TN:"TND",DZ:"DZD",LY:"LYD",SD:"SDG",KE:"KES",TZ:"TZS",UG:"UGX",GH:"GHS",ET:"ETB",ZM:"ZMW",BW:"BWP",NA:"NAD",MZ:"MZN",AO:"AOA",SN:"XOF",CI:"XOF",CM:"XAF",CG:"XAF",CD:"CDF",RW:"RWF",MU:"MUR",MG:"MGA",SC:"SCR",MV:"MVR",FJ:"FJD",PG:"PGK",WS:"WST",TO:"TOP",VU:"VUV",SB:"SBD",TT:"TTD",BB:"BBD",JM:"JMD",BS:"BSD",BZ:"BZD",CR:"CRC",PA:"PAB",GT:"GTQ",HN:"HNL",NI:"NIO",DO:"DOP",BO:"BOB",PY:"PYG",UY:"UYU",SR:"SRD"
};

const countryCurrency = (code: string) => defaultCurrencyByCountry[code] ?? "USD";
const countryTimezone = (code: string) => code === "OM" ? "Asia/Muscat" : "UTC";

export const countries = ISO_COUNTRY_CODES.map(code => ({
  code,
  name: regionNames.of(code) ?? code,
  currency: countryCurrency(code),
  locale: `en-${code}`,
  timezone: countryTimezone(code),
}));

export const languages = ISO_LANGUAGE_CODES.map(code => ({
  code,
  name: languageNames.of(code) ?? code,
}));

export function isValidLanguage(code: string | null | undefined): boolean {
  return !!code && ISO_LANGUAGE_CODES.includes(code.toLowerCase() as LanguageCode);
}

export function isValidCountry(code: string | null | undefined): boolean {
  return !!code && ISO_COUNTRY_CODES.includes(code.toUpperCase() as CountryCode);
}

export function normalizeLocale(language: string | null | undefined, country?: string | null): string {
  const lang = language?.trim().toLowerCase() || appConfig.defaultLanguage;
  if (country && isValidCountry(country) && lang.length <= 3) return `${lang}-${country.toUpperCase()}`;
  return lang;
}

export function currencyFormatter(locale: string, currency: string, minimumFractionDigits?: number) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits });
}
