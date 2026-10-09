import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import {
  many,
  safe,
  vault,
  token,
  feed,
  zeroAddress,
  VAULT,
  InputError,
  client,
  type ReadResult,
} from "./chain";
import { hoursWordsOf } from "./newYork";
export type Asset = {
  token: Address;
  feed: Address;
  pool: Address;
  quoteFeed: Address;
  minLiquidity: bigint;
  tokenDecimals: number;
  feedDecimals: number;
  open: boolean;
  retired: boolean;
  centre: bigint;
  answer?: bigint;
  updatedAt?: bigint;
  poolPrice?: bigint;
  managed?: bigint;
  totalOwed?: bigint;
  short?: boolean;
  balanceReadable: boolean;
  reason?: number;
  symbol: string;
  description: string;
  index: number;
};
export const globalNames = [
  "owner",
  "guardian",
  "pendingOwner",
  "feeRecipient",
  "genesisFinalized",
  "depositsPaused",
  "NAV_CAP",
  "totalSupply",
  "proposalCount",
  "settings",
] as const;
export type Globals = Partial<Record<(typeof globalNames)[number], any>>;
export type Snapshot = {
  assets: Asset[];
  globals: Globals;
  errors: string[];
  complete: boolean;
  aggregate: boolean;
  status?: ReadResult;
  // Latest block timestamp, the clock the vault's hours and freshness use.
  blockTime?: bigint;
  loadedAt: number;
  loading?: boolean;
  retry?: () => void;
};
export const initial: Snapshot = {
  assets: [],
  globals: {},
  errors: [],
  complete: false,
  aggregate: false,
  loadedAt: 0,
};
export async function loadSnapshot(): Promise<Snapshot> {
  const errors: string[] = [],
    globals: Globals = {};
  const [gs, all, status, block] = await Promise.all([
    many(globalNames.map((n) => vault(n))),
    safe(vault("allAssets")),
    safe(vault("depositStatus", [[]])),
    client.getBlock({ blockTag: "latest" }).catch(() => undefined),
  ]);
  if (!block) errors.push("latest block: unreadable");
  gs.forEach((r, i) => {
    if (r.ok) globals[globalNames[i]] = r.value;
    else errors.push(r.error);
  });
  if (!status.ok) errors.push(status.error);
  let assets: Asset[] = [],
    complete = true;
  if (all.ok)
    assets = all.value.map((v: any, index: number) => ({
      ...v.config,
      answer: v.answer,
      updatedAt: v.updatedAt,
      poolPrice: v.poolPrice,
      managed: v.managedBalance,
      totalOwed: v.owedBalance,
      short: v.balanceReadable ? v.shortfall > 0n : undefined,
      balanceReadable: v.balanceReadable,
      reason: Number(v.reason),
      symbol: "unreadable",
      description: "unreadable",
      index,
    }));
  else {
    errors.push(
      "allAssets: unreadable. Showing individual stock reads; pool checks and price reasons are unreadable.",
    );
    const list = await safe(vault("assetTokens"));
    if (!list.ok) {
      complete = false;
      errors.push(list.error);
    } else
      for (let i = 0; i < list.value.length; i++) {
        const c = await safe(vault("asset", [list.value[i]]));
        if (!c.ok) {
          complete = false;
          errors.push(c.error);
          continue;
        }
        const a = c.value;
        const [m, o, p, b] = await many([
          vault("managed", [a.token]),
          vault("totalOwed", [a.token]),
          feed(a.feed, "latestRoundData"),
          token(a.token, "balanceOf", [VAULT]),
        ]);
        assets.push({
          ...a,
          managed: m.ok ? m.value : undefined,
          totalOwed: o.ok ? o.value : undefined,
          answer: p.ok ? p.value[1] : undefined,
          updatedAt: p.ok ? p.value[3] : undefined,
          balanceReadable: b.ok && o.ok,
          short:
            b.ok && o.ok && m.ok
              ? (b.value > o.value ? b.value - o.value : 0n) < m.value
              : undefined,
          index: i,
          symbol: "unreadable",
          description: "unreadable",
        });
        for (const r of [m, o, p, b])
          if (!r.ok) errors.push(`${a.token}: ${r.error}`);
      }
  }
  const meta = await many(
    assets.flatMap((a) => [
      token(a.token, "symbol"),
      feed(a.feed, "description"),
    ]),
  );
  assets.forEach((a, i) => {
    const s = meta[2 * i],
      d = meta[2 * i + 1];
    a.symbol = s.ok ? s.value : "unreadable";
    a.description = d.ok
      ? cleanFeedDescription(d.value, a.symbol)
      : "unreadable";
    if (!s.ok || !d.ok) errors.push(`${a.token}: label unreadable`);
  });
  return {
    assets,
    globals,
    errors,
    complete,
    aggregate: all.ok,
    status,
    blockTime: block?.timestamp,
    loadedAt: Date.now(),
  };
}
export function assetValue(a: Asset): bigint | undefined {
  if (a.retired) return 0n;
  if (a.managed === undefined) return undefined;
  if (a.managed === 0n) return 0n;
  if (a.answer === undefined || a.answer <= 0n) return undefined;
  return (
    (a.managed * a.answer * 10n ** 18n) /
    10n ** BigInt(a.tokenDecimals + a.feedDecimals)
  );
}
export function navOf(assets: Asset[], complete = true) {
  let nav = 0n,
    readable = complete,
    indicative = false;
  for (const a of assets) {
    const v = assetValue(a);
    if (v === undefined) readable = false;
    else nav += v;
    if (a.managed !== 0n && a.reason !== 0) indicative = true;
  }
  return { nav: readable ? nav : undefined, indicative };
}
export function amount(value: string, allowZero = false, decimals = 18) {
  if (
    !new RegExp(`^\\d+(\\.\\d{1,${Math.max(decimals, 1)}})?$`).test(
      value.trim(),
    ) ||
    (decimals === 0 && value.includes("."))
  )
    throw new InputError(
      `Enter a decimal amount with up to ${decimals} decimal places.`,
    );
  const n = parseUnits(value.trim(), decimals);
  if ((!allowZero && n === 0n) || n >= 2n ** 256n)
    throw new InputError(
      "Enter an amount greater than zero and within the supported range.",
    );
  return n;
}
export function address(v: string, allowZero = false): Address {
  if (!isAddress(v.trim()) || (!allowZero && same(v.trim(), zeroAddress)))
    throw new InputError("Enter a valid nonzero address.");
  return v.trim() as Address;
}
export function recipient(v: string): Address {
  const a = address(v);
  if (same(a, VAULT))
    throw new InputError("The receiver must not be the vault.");
  return a;
}
export function uint(v: string, bits = 256) {
  if (!/^\d+$/.test(v) || BigInt(v) >= 2n ** BigInt(bits))
    throw new InputError(`Enter an unsigned ${bits}-bit whole number.`);
  return BigInt(v);
}
export function parseLaunch(input: string) {
  if (!input.trim())
    throw new InputError(
      "Line 1: enter at least one TICKER token feed pool quoteFeed minLiquidity line.",
    );
  const rows: {
    ticker: string;
    token: Address;
    feed: Address;
    pool: Address;
    quoteFeed: Address;
    minLiquidity: bigint;
    line: number;
  }[] = [];
  for (const [i, line] of input.split(/\n/).entries()) {
    if (!line.trim()) continue;
    try {
      const p = line.trim().split(/\s+/);
      if (p.length !== 6)
        throw new InputError(
          "Use TICKER token feed pool quoteFeed minLiquidity.",
        );
      const parseAddress = (value: string, field: string, zero = false) => {
        try {
          return address(value, zero);
        } catch {
          throw new InputError(
            `${field}: invalid address or checksum${zero ? "" : " (nonzero required)"}.`,
          );
        }
      };
      const pool = parseAddress(p[3], "pool", true),
        quoteFeed = parseAddress(p[4], "quoteFeed", true);
      let minLiquidity: bigint;
      try {
        minLiquidity = uint(p[5], 128);
      } catch {
        throw new InputError(
          "minLiquidity: enter an unsigned 128-bit whole number.",
        );
      }
      if (
        same(pool, zeroAddress) &&
        (!same(quoteFeed, zeroAddress) || minLiquidity !== 0n)
      )
        throw new InputError(
          "No pool requires zero quote feed and zero liquidity.",
        );
      if (!same(pool, zeroAddress) && same(quoteFeed, zeroAddress))
        throw new InputError("A pool requires a quote feed.");
      if (!same(pool, zeroAddress) && minLiquidity === 0n)
        throw new InputError(
          "A pool requires a minLiquidity above zero (a zero floor never rejects a drained pool).",
        );
      const token = parseAddress(p[1], "token"),
        feed = parseAddress(p[2], "feed");
      if (rows.some((r) => same(r.token, token)))
        throw new InputError("Each stock must appear only once.");
      if (rows.some((r) => same(r.feed, feed)))
        throw new InputError("Each stock feed must be unique.");
      rows.push({
        ticker: p[0],
        token,
        feed,
        pool,
        quoteFeed,
        minLiquidity,
        line: i + 1,
      });
    } catch (e) {
      throw new InputError(`Line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return rows;
}
export function fmt(n: bigint | undefined, decimals = 18, digits = 4): string {
  if (n === undefined) return "unreadable";
  const [w, f = ""] = formatUnits(n, decimals).split(".");
  const t = f.slice(0, digits).replace(/0+$/, "");
  if (n > 0n && BigInt(w) === 0n && !t && f.replace(/0/g, ""))
    return `<0.${"0".repeat(digits - 1)}1`;
  return `${w === "-0" ? "-0" : BigInt(w).toLocaleString("en-US")}${t ? "." + t : ""}`;
}
export const exact = (n: bigint, d = 18) => formatUnits(n, d);
export const usd = (n: bigint | undefined) =>
  n === undefined ? "unreadable" : "$" + fmt(n, 18, 2);
export const date = (n: bigint | undefined) =>
  n === undefined
    ? "unreadable"
    : n === 0n
      ? "Not set"
      : new Date(Number(n) * 1000).toLocaleString("en-GB", {
          timeZone: "UTC",
        }) + " UTC";
export function age(n: bigint | undefined, now = Date.now() / 1000) {
  if (n === undefined || n === 0n) return "unreadable";
  const s = Math.floor(now - Number(n));
  return s < 0
    ? "Future timestamp"
    : s < 60
      ? "Less than 1 min ago"
      : s < 3600
        ? `${Math.floor(s / 60)} min ago`
        : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}
export const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);
export const depositArgs = (t: Address[], n: bigint[], w: Address, q: bigint) =>
  [t, n, w, (q * 995n) / 1000n, deadline()] as const;
export const redeemArgs = (n: bigint, w: Address, legs: bigint[]) =>
  [n, w, legs.map((a) => (a * 999n) / 1000n), deadline()] as const;
export function cleanFeedDescription(description: string, _symbol = "") {
  return description.replace(/^Robinhood\s+/, "").replace(/^RH\s*/, "");
}
export function pairingMatches(symbol: string, description: string) {
  const clean = cleanFeedDescription(description, symbol);
  return (
    symbol !== "unreadable" &&
    symbol.length > 0 &&
    clean.startsWith(symbol) &&
    [" ", "/", "-"].includes(clean.charAt(symbol.length))
  );
}
export function hoursWords(s: any) {
  return !s ? "unreadable" : hoursWordsOf(s.hoursFrom, s.hoursTo);
}
