export const appConfig = {
  name: "Global Market Platform",
  defaultCountry: "OM",
  defaultCurrency: "OMR",
  defaultLanguage: "ar",
} as const;

export const countryDefaults = {
  OM: { currency: "OMR", locale: "ar-OM", timezone: "Asia/Muscat" },
  SA: { currency: "SAR", locale: "ar-SA", timezone: "Asia/Riyadh" },
  AE: { currency: "AED", locale: "ar-AE", timezone: "Asia/Dubai" },
  US: { currency: "USD", locale: "en-US", timezone: "America/New_York" },
  GB: { currency: "GBP", locale: "en-GB", timezone: "Europe/London" },
  TR: { currency: "TRY", locale: "tr-TR", timezone: "Europe/Istanbul" },
  DE: { currency: "EUR", locale: "de-DE", timezone: "Europe/Berlin" },
} as const;

export type CountryCode = keyof typeof countryDefaults;

export const fallbackLanguages = [
  { code: "ar", name: "العربية" },
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "de", name: "Deutsch" },
] as const;

export const countries = Object.entries(countryDefaults).map(([code, value]) => ({
  code,
  name: code,
  currency: value.currency,
  locale: value.locale,
  timezone: value.timezone,
}));

export const languages = fallbackLanguages;

export function isValidLanguage(code: string | null | undefined): boolean {
  return !!code && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(code);
}

export function normalizeLocale(language: string | null | undefined, country?: string | null): string {
  const lang = language?.trim() || appConfig.defaultLanguage;
  return country && lang.length <= 3 ? `${lang}-${country.toUpperCase()}` : lang;
}
