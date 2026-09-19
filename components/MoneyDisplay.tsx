import type { ReactNode } from "react";
import { formatMoneyParts } from "../lib/currency-display";

type Props = {
  value: number | null | undefined;
  currency: string;
  locale?: string;
  maximumFractionDigits?: number;
  className?: string;
};

export default function MoneyDisplay({
  value,
  currency,
  locale = "en-US",
  maximumFractionDigits = 3,
  className = "",
}: Props): ReactNode {
  const parts = formatMoneyParts(value, currency, locale, maximumFractionDigits);
  if (parts.kind === "empty") return <span className={className}>—</span>;
  if (parts.kind !== "omr") return <span className={className}>{parts.text}</span>;
  return (
    <span className={"money-display money-display-omr " + className}>
      <span className="omr-symbol" aria-hidden="true" />
      <span className="money-display-number">{parts.text}</span>
      <span className="sr-only">ريال عُماني</span>
    </span>
  );
}
