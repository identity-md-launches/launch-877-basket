import { formatUnits, parseUnits } from "viem";
import { InputError } from "./chain";

// SPEC 4: pool tokens retain all 18 decimals; a positive sub-display unit is never 0.
export function itemAmount(value: bigint, decimals = 18, pool = false): string {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const shown = fraction.slice(0, pool ? decimals : 6).replace(/0+$/, "");
  if (value > 0n && BigInt(whole) === 0n && !shown) return "<0.000001";
  return BigInt(whole).toLocaleString("en-US") + (shown ? "." + shown : "");
}
export function parseItemAmount(text: string): bigint | undefined {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(text)) return undefined;
  const amount = parseUnits(text, 18);
  return amount > 0n && amount < 2n ** 256n ? amount : undefined;
}
export function itemShare(staked: bigint, total: bigint): string {
  if (!total || !staked) return "0%";
  const scaled = staked * 100n * 10n ** 18n / total;
  return (scaled === 0n ? "<0.000001" : itemAmount(scaled)) + "%";
}

// 2026-10-16, Add liquidity build: v2 quote and proportional mint, all rounded down.
export function itemLiquidityQuote(amount: bigint, reserveA: bigint, reserveB: bigint, supply: bigint) {
  if (reserveA <= 0n || reserveB <= 0n || supply <= 0n) throw new InputError("Pool not seeded yet.");
  if (amount <= 0n || amount >= 2n ** 256n) throw new InputError("Enter an amount.");
  const matched = amount * reserveB / reserveA;
  const minimumA = amount * 995n / 1000n, minimumB = matched * 995n / 1000n;
  if (matched <= 0n || matched >= 2n ** 256n || minimumA <= 0n || minimumB <= 0n) throw new InputError("Enter an amount.");
  const fromA = amount * supply / reserveA, fromB = matched * supply / reserveB;
  return { matched, minimumA, minimumB, poolTokens: fromA < fromB ? fromA : fromB };
}
// Keep even a positive ratio smaller than one base unit visible.
export function itemRatioAmount(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n || numerator === 0n) return "0";
  const result = numerator / denominator;
  return result === 0n && numerator > 0n ? "<0.000001" : itemAmount(result);
}

// Owner correction: value the unclaimed BASK reward using the existing vault NAV.
// All amounts use 18 decimals. Keep the product exact until the final cent cut.
export function itemRewardUsd(earned: bigint, nav: bigint | undefined, supply: bigint | undefined): string {
  if (nav === undefined || supply === undefined || supply <= 0n || nav < 0n || earned < 0n) return "Unavailable";
  const product = earned * nav;
  const cents = product / (supply * 10n ** 16n);
  if (product > 0n && cents === 0n) return "<$0.01";
  return "$" + (cents / 100n).toLocaleString("en-US") + "." + (cents % 100n).toString().padStart(2, "0");
}
