import { formatUnits, parseUnits } from "viem";
import { InputError } from "./chain";
import { navOf, type Snapshot } from "./model";

export function freshPriceTime(updatedAt: unknown, now = BigInt(Math.floor(Date.now() / 1000))): updatedAt is bigint {
  return typeof updatedAt === "bigint" && updatedAt > 0n && updatedAt <= now && now - updatedAt <= 26n * 60n * 60n;
}
// Both token prices are USD scaled by 1e18. Keep all reserve/feed arithmetic integral.
export function poolUsdPrice(reserves: unknown, token0: unknown, token: string, quote: string, quoteDecimals: number, round: unknown, decimals: unknown, now: bigint): bigint | undefined {
  if (!Array.isArray(reserves) || typeof reserves[0] !== "bigint" || typeof reserves[1] !== "bigint" || reserves[0] <= 0n || reserves[1] <= 0n || typeof token0 !== "string") return undefined;
  if (!Array.isArray(round) || round.length !== 5 || !round.every(x => typeof x === "bigint") || round[1] <= 0n || !freshPriceTime(round[3], now) || round[4] < round[0]) return undefined;
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return undefined;
  const first = token0.toLowerCase() === token.toLowerCase();
  if (!first && token0.toLowerCase() !== quote.toLowerCase()) return undefined;
  const baseReserve = reserves[first ? 0 : 1], quoteReserve = reserves[first ? 1 : 0];
  const result = quoteReserve * round[1] * 10n ** 36n / (baseReserve * 10n ** BigInt(quoteDecimals + decimals));
  return result > 0n ? result : undefined;
}
export function navUsdPrice(snapshot?: Snapshot, now = BigInt(Math.floor(Date.now() / 1000))): bigint | undefined {
  if (!snapshot || snapshot.loading || !snapshot.loadedAt || !snapshot.complete || now * 1000n - BigInt(snapshot.loadedAt) > 26n * 60n * 60n * 1000n) return undefined;
  const supply = snapshot.globals.totalSupply;
  if (typeof supply !== "bigint" || supply <= 0n) return undefined;
  if (snapshot.assets.some(a => a.managed !== 0n && (a.answer === undefined || a.answer <= 0n || !freshPriceTime(a.updatedAt, now)))) return undefined;
  const { nav } = navOf(snapshot.assets, snapshot.complete);
  return nav !== undefined && nav >= 0n ? nav * 10n ** 18n / supply : undefined;
}
export function usdPrice(value: bigint | undefined, decimals: 2 | 6): string {
  if (value === undefined || value < 0n) return "—";
  const unit = 10n ** BigInt(18 - decimals);
  if (value > 0n && value < unit) return decimals === 2 ? "<$0.01" : "<$0.000001";
  const rounded = (value + unit / 2n) / unit, scale = 10n ** BigInt(decimals);
  return "$" + (rounded / scale).toLocaleString("en-US") + "." + (rounded % scale).toString().padStart(decimals, "0");
}

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
