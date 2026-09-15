export const appConfig = {
  name: "Global Market Platform",
  defaultCountry: "OM",
  defaultCurrency: "OMR",
  defaultLanguage: "ar",
};

export const countries = [
  { code: "OM", name: "Oman", currency: "OMR", locale: "ar-OM" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", locale: "ar-SA" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", locale: "ar-AE" },
  { code: "US", name: "United States", currency: "USD", locale: "en-US" },
  { code: "GB", name: "United Kingdom", currency: "GBP", locale: "en-GB" },
  { code: "TR", name: "Türkiye", currency: "TRY", locale: "tr-TR" },
  { code: "DE", name: "Germany", currency: "EUR", locale: "de-DE" },
] as const;

export const languages = [
  { code: "ar", name: "العربية" },
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "de", name: "Deutsch" },
] as const;
