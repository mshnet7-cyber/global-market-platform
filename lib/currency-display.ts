const OMANI_RIAL_FALLBACK = "OMR";

export type MoneyDisplayParts =
  | { kind: "empty"; text: "—" }
  | { kind: "omr"; text: string }
  | { kind: "text"; text: string };

export function formatMoneyParts(
  value: number | null | undefined,
  currency: string,
  locale = "en-US",
  maximumFractionDigits = 3,
): MoneyDisplayParts {
  if (value == null || !Number.isFinite(value)) return { kind: "empty", text: "—" };
  const code = currency.toUpperCase();
  if (code === "OMR") {
    const number = new Intl.NumberFormat(locale, {
      minimumFractionDigits: Math.min(3, maximumFractionDigits),
      maximumFractionDigits,
    }).format(value);
    return { kind: "omr", text: number };
  }
  try {
    return {
      kind: "text",
      text: new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        maximumFractionDigits,
      }).format(value),
    };
  } catch {
    return {
      kind: "text",
      text: value.toLocaleString(locale, { maximumFractionDigits, numberingSystem: "latn" }) + " " + (code || OMANI_RIAL_FALLBACK),
    };
  }
}

export function formatMoneyDisplay(
  value: number | null | undefined,
  currency: string,
  locale = "en-US",
  maximumFractionDigits = 3,
) {
  const parts = formatMoneyParts(value, currency, locale, maximumFractionDigits);
  if (parts.kind === "empty") return parts.text;
  if (parts.kind === "omr") return OMANI_RIAL_FALLBACK + " " + parts.text;
  return parts.text;
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
