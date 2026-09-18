const OMANI_RIAL_SIGN = "\u20C4";

export function formatMoneyDisplay(
  value: number | null | undefined,
  currency: string,
  locale = "en-US",
  maximumFractionDigits = 3,
) {
  if (value == null || !Number.isFinite(value)) return "—";
  const code = currency.toUpperCase();
  if (code === "OMR") {
    const number = new Intl.NumberFormat(locale, {
      minimumFractionDigits: Math.min(3, maximumFractionDigits),
      maximumFractionDigits,
    }).format(value);
    return OMANI_RIAL_SIGN + " " + number;
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits,
    }).format(value);
  } catch {
    return value.toLocaleString(locale, { maximumFractionDigits }) + " " + code;
  }
}

export function formatNumberDisplay(
  value: number | null | undefined,
  locale = "en-US",
  maximumFractionDigits = 3,
) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}
