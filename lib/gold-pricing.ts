export type GoldPricingDirection = "buy" | "sell";

export type GoldPricingInput = {
  marketPerGram24k: number;
  weightGrams: number;
  karat: 24 | 22 | 21 | 18 | 14;
  direction: GoldPricingDirection;
  spreadPerGram?: number;
  makingPerGram?: number;
  wastagePercent?: number;
  taxRate?: number;
  roundingIncrement?: number;
  includeWorkmanship?: boolean;
};

export type GoldPricingBreakdown = {
  currency: string | null;
  purityFactor: number;
  baseUnitPrice: number;
  metalValue: number;
  wastageValue: number;
  spreadValue: number;
  workmanshipValue: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  totalBeforeTax: number;
  rounded: boolean;
};

const KARAT_FACTOR: Record<number, number> = {
  24: 1,
  22: 22 / 24,
  21: 21 / 24,
  18: 18 / 24,
  14: 14 / 24,
};

function finite(value: number | undefined | null, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function roundToIncrement(value: number, increment = 0.001) {
  const safeIncrement = increment > 0 && Number.isFinite(increment) ? increment : 0.001;
  return Math.round((value + Number.EPSILON) / safeIncrement) * safeIncrement;
}

export function calculateGoldPrice(input: GoldPricingInput): GoldPricingBreakdown {
  if (!Number.isFinite(input.marketPerGram24k) || input.marketPerGram24k < 0) throw new Error("invalid_market_price");
  if (!Number.isFinite(input.weightGrams) || input.weightGrams < 0) throw new Error("invalid_weight");
  if (!Object.prototype.hasOwnProperty.call(KARAT_FACTOR, input.karat)) throw new Error("invalid_karat");

  const purityFactor = KARAT_FACTOR[input.karat];
  const baseUnitPrice = input.marketPerGram24k * purityFactor;
  const metalValue = baseUnitPrice * input.weightGrams;
  const wastageValue = metalValue * Math.max(0, finite(input.wastagePercent)) / 100;
  const rawSpread = Math.max(0, finite(input.spreadPerGram)) * input.weightGrams;
  const spreadValue = input.direction === "sell" ? rawSpread : -rawSpread;
  const workmanshipValue = input.direction === "sell" && input.includeWorkmanship !== false
    ? Math.max(0, finite(input.makingPerGram)) * input.weightGrams
    : 0;
  const totalBeforeTax = Math.max(0, metalValue + wastageValue + spreadValue + workmanshipValue);
  const taxAmount = totalBeforeTax * Math.max(0, finite(input.taxRate)) / 100;
  const total = roundToIncrement(totalBeforeTax + taxAmount, input.roundingIncrement);
  return {
    currency: null,
    purityFactor,
    baseUnitPrice,
    metalValue,
    wastageValue,
    spreadValue,
    workmanshipValue,
    subtotal: totalBeforeTax,
    taxAmount,
    total,
    totalBeforeTax,
    rounded: Math.abs(total - (totalBeforeTax + taxAmount)) > Number.EPSILON,
  };
}

export const GOLD_KARATS = [24, 22, 21, 18, 14] as const;
