import { poolMetrics } from "./poolMath";
import { parseAbi, type Address } from "viem";
import {
  read,
  client,
  vault,
  token,
  feed,
  zeroAddress,
  InputError,
  proposalKinds,
  minutesOf,
  VAULT,
} from "./chain";
import {
  address,
  amount,
  uint,
  same,
  cleanFeedDescription,
  pairingMatches,
  parseLaunch,
  usd,
} from "./model";
import { dstWords, hoursWordsOf, parseHours } from "./newYork";
export const settingNames = [
  "Band",
  "MaxAge",
  "NoPoolAge",
  "FreshCount",
  "FreshHours",
  "Hours",
  "Dst",
  "PoolWindow",
  "PoolDeviation",
  "FeedGas",
  "PauseGas",
  "PoolGas",
  "BalanceGas",
  "PayGas",
  "MaxAssets",
  "DirectLimit",
] as const;
export const settingFields = [
  "band",
  "maxAge",
  "noPoolAge",
  "freshCount",
  "freshHours",
  "hoursFrom / hoursTo",
  "dst",
  "poolWindow",
  "poolDeviation",
  "feedGas",
  "pauseGas",
  "poolGas",
  "balanceGas",
  "payGas",
  "maxAssets",
  "directLimit",
];
export const settingBounds = [
  "2–100",
  "3,600–2,592,000 seconds",
  "3,600–2,592,000 seconds",
  "0–10",
  "1–48 hours",
  "Seconds since Sunday 00:00 New York time; from < to ≤ 604,800, or both zero for always open",
  "0 (US daylight saving rule), 1 (never daylight saving, UTC-5) or 2 (always daylight saving, UTC-4)",
  "300–86,400 seconds",
  "50–2,000 basis points",
  "20,000–500,000",
  "20,000–500,000",
  "20,000–500,000",
  "20,000–500,000 gas, and the vault's combined rules: maxAssets × (balanceGas + 60,000) ≤ 28,000,000 and directLimit × (balanceGas + payGas + 70,000) ≤ 28,000,000",
  "20,000–500,000 gas, and the vault's combined rule: directLimit × (balanceGas + payGas + 70,000) ≤ 28,000,000",
  "At least assetCount; maxAssets × (balanceGas + 60,000) ≤ 28,000,000",
  "directLimit × (balanceGas + payGas + 70,000) ≤ 28,000,000; zero disables direct attempts",
];
// BaskVault._changedSettings refuses maxAssets > 28,000,000 / (balanceGas + 60,000)
// and directLimit > 28,000,000 / (balanceGas + payGas + 70,000) (whole-number
// division), so BalanceGas (12) and PayGas (13) have a current maximum.
const GAS_BUDGET = 28_000_000n;
export function gasMaximum(key: number, s: any): bigint | undefined {
  if (!s || (key !== 12 && key !== 13)) return undefined;
  const maxAssets = BigInt(s.maxAssets),
    directLimit = BigInt(s.directLimit),
    other = BigInt(key === 12 ? s.payGas : s.balanceGas);
  let max = 500_000n;
  if (key === 12 && maxAssets > 0n && GAS_BUDGET / maxAssets - 60_000n < max)
    max = GAS_BUDGET / maxAssets - 60_000n;
  if (
    directLimit > 0n &&
    GAS_BUDGET / directLimit - 70_000n - other < max
  )
    max = GAS_BUDGET / directLimit - 70_000n - other;
  return max;
}
const grouped = (n: unknown) => BigInt(n as bigint).toLocaleString("en-US");
// The bounds line; BalanceGas and PayGas add the maximum under current settings().
export function settingBoundsWords(key: number, s: any): string {
  if (key !== 12 && key !== 13) return settingBounds[key];
  if (!s) return `${settingBounds[key]}. Current maximum unreadable — Retry vault.`;
  const max = gasMaximum(key, s)!;
  const from =
    key === 12
      ? `maxAssets ${grouped(s.maxAssets)}, directLimit ${grouped(s.directLimit)}, payGas ${grouped(s.payGas)}`
      : `directLimit ${grouped(s.directLimit)}, balanceGas ${grouped(s.balanceGas)}`;
  return max < 20_000n
    ? `${settingBounds[key]}. With the current ${from}, no value fits: lower ${key === 12 ? "MaxAssets or DirectLimit" : "DirectLimit"} first.`
    : `${settingBounds[key]}. Current maximum ${grouped(max)} (with the current ${from}).`;
}
// minLiquidity is compared with a 128-bit pool liquidity, so it is limited to
// 128 bits like the listing parser (a larger floor would refuse every pool).
function minLiquidityOf(v: string) {
  try {
    return uint(v, 128);
  } catch {
    throw new InputError(
      "Minimum raw pool liquidity: enter an unsigned 128-bit whole number.",
    );
  }
}
export function poolValues(v: Record<string, string>) {
  const p = address(v.pool, true),
    q = address(v.quoteFeed, true),
    l = minLiquidityOf(v.minLiquidity);
  if (same(p, zeroAddress) && (!same(q, zeroAddress) || l !== 0n))
    throw new InputError(
      "No pool requires zero quote feed and zero liquidity.",
    );
  if (!same(p, zeroAddress) && same(q, zeroAddress))
    throw new InputError("A pool requires its quote feed.");
  if (!same(p, zeroAddress) && l === 0n)
    throw new InputError(
      "A pool requires a minLiquidity above zero (a zero floor never rejects a drained pool).",
    );
  return [p, q, l] as const;
}
// BaskVault.Action: kind, token, target, pool, quoteFeed, value, value2, setting.
export type Action = {
  kind: number;
  token: Address;
  target: Address;
  pool: Address;
  quoteFeed: Address;
  value: bigint;
  value2: bigint;
  setting: number;
};
const empty: Action = {
  kind: 0,
  token: zeroAddress,
  target: zeroAddress,
  pool: zeroAddress,
  quoteFeed: zeroAddress,
  value: 0n,
  value2: 0n,
  setting: 0,
};
// Under Dst 0 (US rule) New York skips Sunday 2:00-2:59 am on the
// spring-forward Sunday, so a start in that hour has no clean reopen time.
export const SPRING_FORWARD_START =
  "Sunday 2:00-2:59 am New York is skipped on the spring-forward Sunday; choose another start.";
export function springForwardStart(from: bigint, dst: bigint) {
  return dst === 0n && from >= 7200n && from < 10800n;
}
// settings: the current settings(); its Dst decides the spring-forward refusal
// (unreadable counts as Dst 0, the stricter case).
export function settingValues(
  v: Record<string, string>,
  settings?: any,
): [number, bigint, bigint] {
  const key = Number(v.setting ?? "0");
  if (!settingNames[key]) throw new InputError("Choose a setting.");
  if (key === 5) {
    const [from, to] = parseHours(v.from ?? "", v.to ?? "");
    if (springForwardStart(from, settings ? BigInt(settings.dst) : 0n))
      throw new InputError(SPRING_FORWARD_START);
    return [key, from, to];
  }
  const value = uint(v.value || "0");
  if (key === 6 && value > 2n) throw new InputError("Dst is 0, 1 or 2.");
  return [key, value, 0n];
}
// The vault can never act as owner or guardian, so neither may be the vault.
export function newOwner(v: string): Address {
  const next = address(v);
  if (same(next, VAULT))
    throw new InputError("The new owner must not be the vault.");
  return next;
}
function newGuardian(v: string): Address {
  const next = address(v);
  if (same(next, VAULT))
    throw new InputError("The new guardian must not be the vault.");
  return next;
}
// BaskVault refuses the vault itself as fee recipient (InvalidAddress).
function feeRecipient(v: string): Address {
  const target = address(v);
  if (same(target, VAULT))
    throw new InputError("The fee recipient must not be the vault.");
  return target;
}
// Fields per kind follow the Action comment in BaskVault.sol; unused fields are zero.
// settings: the current settings(), used only to refuse a spring-forward Hours start.
export function proposalAction(
  kind: number,
  v: Record<string, string>,
  settings?: any,
): Action {
  const a: Action = { ...empty, kind };
  switch (kind) {
    case 0: {
      const [pool, quoteFeed, value] = poolValues(v);
      return {
        ...a,
        token: address(v.token),
        target: address(v.feed),
        pool,
        quoteFeed,
        value,
      };
    }
    case 1:
      return { ...a, token: address(v.token), target: address(v.feed) };
    case 2:
    case 3:
    case 4:
    case 6:
      return { ...a, token: address(v.token) };
    case 5: {
      const [pool, quoteFeed, value] = poolValues(v);
      return { ...a, token: address(v.token), pool, quoteFeed, value };
    }
    case 7:
      return { ...a, target: newGuardian(v.next) };
    case 8:
      return { ...a, value: amount(v.cap) };
    case 9:
      return { ...a, target: feeRecipient(v.recipient) };
    case 10: {
      const [setting, value, value2] = settingValues(v, settings);
      return { ...a, setting, value, value2 };
    }
    default:
      throw new InputError("Choose a proposal kind.");
  }
}
export function proposalSpec(
  kind: number,
  v: Record<string, string>,
  settings?: any,
) {
  return vault("propose", [proposalAction(kind, v, settings)]);
}
// settings: the current settings(), for the Hours zone and the FreshHours window.
export function proposalWords(a: Action, settings?: any) {
  try {
    switch (Number(a.kind)) {
      case 0:
        return `Feed ${a.target}; pool ${a.pool}; quote feed ${a.quoteFeed}; minimum liquidity ${a.value}`;
      case 1:
        return `New feed ${a.target}`;
      case 2:
        return "Re-centre the band at the feed answer at execution.";
      case 3:
        return "Reopen this stock for deposits.";
      case 4:
        return "Retire permanently; zero in deposit NAV, still paid on redemption.";
      case 5:
        return `Pool ${a.pool}; quote feed ${a.quoteFeed}; minimum liquidity ${a.value}`;
      case 6:
        return "Add positive excess to managed holdings. Keep deposits paused until executed and checked.";
      case 7:
        return `New guardian ${a.target}`;
      case 8:
        return `New size limit ${usd(a.value)}`;
      case 9:
        return `Fee recipient ${a.target}. Fees begin when executed; the recipient can never be unset.`;
      case 10: {
        const k = Number(a.setting);
        return k === 5
          ? `hoursFrom / hoursTo = ${a.value} / ${a.value2}; ${settingWords(k, a.value, a.value2, settings)}`
          : `${settingFields[k]} = ${a.value}; ${settingWords(k, a.value, 0n, settings)}`;
      }
      default:
        return "Unknown action. Retry.";
    }
  } catch {
    return "Proposal data unreadable. Retry.";
  }
}
const poolAbi = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function observe(uint32[]) view returns (int56[], uint160[])",
]);
export type Listing = ReturnType<typeof parseLaunch>[number];
export type Pairing = Listing & {
  symbol: string;
  description: string;
  price?: bigint;
  feedDecimals: number;
  poolSymbols: string;
  quoteName: string;
  listed: boolean;
  marked: boolean;
  error?: string;
  liquidity?: bigint;
  gapBps?: bigint;
  poolPrice?: bigint;
  warning?: string;
  // settings().poolWindow (seconds) the liquidity was measured over.
  poolWindow?: bigint;
};
export async function inspectListing(row: Listing): Promise<Pairing> {
  // asset() reverts for an unlisted token: decide "listed" from assetTokens().
  const [symbol, description, price, decimals, listedTokens, settings] =
    await Promise.all([
      read(token(row.token, "symbol")),
      read(feed(row.feed, "description")),
      read(feed(row.feed, "latestRoundData")),
      read(feed(row.feed, "decimals")),
      read(vault("assetTokens")),
      read(vault("settings")),
    ]);
  const listed = (listedTokens as Address[]).some((t) => same(t, row.token));
  const config = listed ? await read(vault("asset", [row.token])) : undefined;
  let liquidity: bigint | undefined,
    gapBps: bigint | undefined,
    poolPrice: bigint | undefined,
    error: string | undefined,
    warning: string | undefined;
  let poolSymbols = "No pool",
    quoteName = "No quote feed";
  if (!same(row.pool, zeroAddress)) {
    const [t0, t1, qd] = await Promise.all([
      read({ address: row.pool, abi: poolAbi, functionName: "token0" }),
      read({ address: row.pool, abi: poolAbi, functionName: "token1" }),
      read(feed(row.quoteFeed, "description")),
    ]);
    if (!same(t0, row.token) && !same(t1, row.token))
      throw new InputError("The pool does not include this Stock Token.");
    const symbols = await Promise.all([
      read(token(t0, "symbol")),
      read(token(t1, "symbol")),
    ]);
    poolSymbols = symbols.join(" / ");
    quoteName = cleanFeedDescription(qd);
    const window = BigInt(settings.poolWindow);
    const [observations, td, quoteDecimals, qfd, qround] = await Promise.all([
      read({
        address: row.pool,
        abi: poolAbi,
        functionName: "observe",
        args: [[Number(window), 0]],
      }),
      read(token(row.token, "decimals")),
      read(token(same(t0, row.token) ? t1 : t0, "decimals")),
      read(feed(row.quoteFeed, "decimals")),
      read(feed(row.quoteFeed, "latestRoundData")),
    ]);
    if (price[1] <= 0n || qround[1] <= 0n)
      throw new InputError("Stock or quote feed answer is invalid.");
    const block = await client.getBlock({ blockTag: "latest" });
    if (
      qround[3] > block.timestamp ||
      block.timestamp - qround[3] > BigInt(settings.maxAge)
    )
      throw new InputError("Quote feed is stale or has a future timestamp.");
    const metric = poolMetrics(
      observations[0],
      observations[1],
      window,
      same(t0, row.token),
      Number(td),
      Number(quoteDecimals),
      qround[1],
      Number(qfd),
    );
    liquidity = metric.liquidity;
    poolPrice = metric.price;
    const feedPrice = (price[1] * 10n ** 18n) / 10n ** BigInt(decimals);
    if (!feedPrice) throw new InputError("Feed price normalizes to zero.");
    const difference =
      poolPrice > feedPrice ? poolPrice - feedPrice : feedPrice - poolPrice;
    gapBps = (difference * 10000n) / feedPrice;
    if (liquidity < row.minLiquidity)
      error = `${minutesOf(window)} pool liquidity is under minLiquidity.`;
    if (difference > (feedPrice * BigInt(settings.poolDeviation)) / 10000n)
      error =
        (error ? error + " " : "") + "Pool-vs-feed gap is over poolDeviation.";
    if (liquidity * 2n < row.minLiquidity * 3n)
      warning = "Liquidity is under 1.5× minLiquidity.";
  }
  const cleaned = cleanFeedDescription(description, symbol);
  if (config) {
    const differences = ["feed", "pool", "quoteFeed"].filter(
      (k) => !same(config[k], row[k as "feed" | "pool" | "quoteFeed"]),
    );
    if (config.minLiquidity !== row.minLiquidity)
      differences.push("minLiquidity");
    if (differences.length)
      error = `Already-listed row differs: ${differences.join(", ")}. Correct the pasted line.`;
  }
  return {
    ...row,
    symbol,
    liquidity,
    gapBps,
    poolPrice,
    error,
    warning,
    description: cleaned,
    price: price[1],
    feedDecimals: Number(decimals),
    poolSymbols,
    quoteName,
    listed,
    marked: row.ticker !== symbol || !pairingMatches(symbol, cleaned),
    poolWindow: BigInt(settings.poolWindow),
  };
}
export { proposalKinds };

const hoursOf = (n: bigint) => `${n} hour${n === 1n ? "" : "s"}`;
// FreshCount in words; hours is the current FreshHours when readable.
export function freshWords(count: bigint, hours?: bigint) {
  if (count === 0n) return "off: deposits stay open when prices stop";
  return `at least ${count} listed stock price${count === 1n ? "" : "s"} updated within the last ${hours === undefined ? "FreshHours hours" : hoursOf(hours)}; deposits close when prices stop (US market holidays) until one updates`;
}
// settings: the current settings(), when readable. Hours (5) are written in
// its Dst zone (New York time, UTC-5 or UTC-4); FreshCount (3) uses its FreshHours.
export function settingWords(key: number, n: bigint, n2 = 0n, settings?: any) {
  if (key === 0) return `centre /${n} to ×${n}`;
  if ([1, 2, 7].includes(key)) return `${Number(n) / 3600} hours (${n} s)`;
  if (key === 8) return `${Number(n) / 100}% (${n} basis points)`;
  if (key === 5)
    return hoursWordsOf(n, n2, settings ? BigInt(settings.dst) : 0n);
  if (key === 6) return dstWords[Number(n)] ?? "unknown daylight rule";
  if (key === 15)
    return `With at most ${n} held stocks, every leg is tried now; with more, every leg is owed for claims. Zero disables direct attempts.`;
  if (key === 3)
    return freshWords(
      n,
      settings ? BigInt(settings.freshHours) : undefined,
    );
  if (key === 4)
    return `${hoursOf(n)}; deposits need FreshCount prices updated within this window, so they close when prices stop (US market holidays) until one updates`;
  if (key >= 9 && key <= 13) return `${n} gas`;
  return `${n} stocks`;
}
