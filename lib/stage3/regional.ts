import { formatMoneyDisplay } from "../currency-display";

export type RegionalProfile = {
  countryCode: string;
  locale: string;
  currency: string;
  timezone: string;
  taxModel: string;
  invoiceProfile: string;
  paymentProfile: string;
  dataProfile: string;
  defaultLanguage: string;
  direction: "rtl" | "ltr";
};

const profiles: Record<string, RegionalProfile> = {
  OM: { countryCode:"OM", locale:"ar-OM", currency:"OMR", timezone:"Asia/Muscat", taxModel:"oman", invoiceProfile:"oman_einvoice", paymentProfile:"oman", dataProfile:"oman", defaultLanguage:"ar", direction:"rtl" },
  SA: { countryCode:"SA", locale:"ar-SA", currency:"SAR", timezone:"Asia/Riyadh", taxModel:"saudi", invoiceProfile:"zatca_fatoorah", paymentProfile:"saudi", dataProfile:"saudi", defaultLanguage:"ar", direction:"rtl" },
  AE: { countryCode:"AE", locale:"ar-AE", currency:"AED", timezone:"Asia/Dubai", taxModel:"uae", invoiceProfile:"uae_einvoice", paymentProfile:"uae", dataProfile:"uae", defaultLanguage:"ar", direction:"rtl" },
};

export function getRegionalProfile(countryCode: string): RegionalProfile {
  const code = countryCode.toUpperCase();
  return profiles[code] ?? {
    countryCode: code,
    locale: "en-" + code,
    currency: "USD",
    timezone: "UTC",
    taxModel: "generic",
    invoiceProfile: "generic",
    paymentProfile: "generic",
    dataProfile: "generic",
    defaultLanguage: "en",
    direction: "ltr",
  };
}

export function formatRegionalMoney(value: number, profile: RegionalProfile) {
  return formatMoneyDisplay(value, profile.currency, profile.locale, 3);
}

export function formatRegionalDate(value: Date | string | number, profile: RegionalProfile) {
  return new Intl.DateTimeFormat(profile.locale, { dateStyle:"medium", timeStyle:"short", timeZone:profile.timezone }).format(new Date(value));
}
