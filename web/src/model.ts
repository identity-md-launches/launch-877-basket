import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import {
  many,
  read,
  safe,
  vault,
  token,
  feed,
  zeroAddress,
  VAULT,
  InputError,
  type ReadResult,
} from "./chain";
export type Asset = {
  token: Address;
  feed: Address;
  answer?: bigint;
  updatedAt?: bigint;
  minAnswer: bigint;
  maxAnswer: bigint;
  open: boolean;
  retired: boolean;
  probation: boolean;
  listedAt: bigint;
  managed?: bigint;
  short?: boolean;
  balanceReadable: boolean;
  feedReadable: boolean;
  totalOwed?: bigint;
  symbol: string;
  description: string;
  status?: ReadResult<[number, Address]>;
  index: number;
};
export const globalNames = [
  "owner",
  "guardian",
  "pendingOwner",
  "feeRecipient",
  "genesisFinalized",
  "depositsPaused",
  "depositsOpenAt",
  "NAV_CAP",
  "totalSupply",
  "proposalCount",
] as const;
export type Globals = Partial<Record<(typeof globalNames)[number], any>>;
export type Snapshot = {
  assets: Asset[];
  globals: Globals;
  errors: string[];
  complete: boolean;
  loadedAt: number;
};
export const initial: Snapshot = {
  assets: [],
  globals: {},
  errors: [],
  complete: false,
  loadedAt: 0,
};
export async function loadSnapshot(): Promise<Snapshot> {
  const errors: string[] = [];
  const globals: Globals = {};
  const [globalResults, aggregate] = await Promise.all([
    many(globalNames.map((n) => vault(n))),
    safe(vault("allAssets")),
  ]);
  globalResults.forEach((r, i) => {
    if (r.ok) globals[globalNames[i]] = r.value;
    else errors.push(r.error);
  });
  let assets: Asset[] = [];
  let complete = true;
  if (aggregate.ok)
    assets = aggregate.value.map((a: Asset, i: number) => ({ ...a, index: i }));
  else {
    errors.push("allAssets: unreadable. Showing individual stock reads.");
    const count = await safe(vault("assetCount"));
    if (!count.ok) {
      errors.push(count.error);
      complete = false;
    } else
      for (let i = 0; i < Number(count.value); i++) {
        // Isolated calls intentionally preserve healthy assets if any feed exhausts gas.
        const row = await safe(vault("assets", [BigInt(i)]));
        if (!row.ok) {
          errors.push(`Stock ${i + 1}: unreadable`);
          complete = false;
          continue;
        }
        const [
          t,
          f,
          open,
          retired,
          genesisAsset,
          minAnswer,
          maxAnswer,
          listedAt,
        ] = row.value;
        const managed = await safe(vault("managed", [t]));
        const debt = await safe(vault("totalOwed", [t]));
        const price = await safe(feed(f, "latestRoundData"));
        const balance = await safe(token(t, "balanceOf", [VAULT]));
        const available =
          balance.ok && debt.ok
            ? balance.value > debt.value
              ? balance.value - debt.value
              : 0n
            : undefined;
        assets.push({
          token: t,
          feed: f,
          open,
          retired,
          minAnswer,
          maxAnswer,
          listedAt,
          index: i,
          probation:
            !genesisAsset &&
            BigInt(Math.floor(Date.now() / 1000)) < listedAt + 30n * 86400n,
          managed: managed.ok ? managed.value : undefined,
          totalOwed: debt.ok ? debt.value : undefined,
          answer: price.ok ? price.value[1] : undefined,
          updatedAt: price.ok ? price.value[3] : undefined,
          balanceReadable: balance.ok && debt.ok,
          feedReadable: price.ok,
          short:
            available !== undefined && managed.ok
              ? available < managed.value
              : undefined,
          symbol: "unreadable",
          description: "unreadable",
        });
        for (const r of [managed, debt, price, balance])
          if (!r.ok) errors.push(`${t}: ${r.error}`);
      }
  }
  const meta = await many(
    assets.flatMap((a) => [
      token(a.token, "symbol"),
      feed(a.feed, "description"),
    ]),
  );
  assets.forEach((a, i) => {
    const sym = meta[2 * i],
      desc = meta[2 * i + 1];
    a.symbol = sym.ok ? sym.value : "unreadable";
    a.description = desc.ok ? desc.value : "unreadable";
  });
  await Promise.all(
    assets.map(async (a) => {
      if (a.open && !a.retired)
        a.status = await safe(vault("depositStatus", [a.token]));
    }),
  );
  return { assets, globals, errors, complete, loadedAt: Date.now() };
}
export function navOf(
  assets: Asset[],
  complete = true,
  now = Date.now() / 1000,
) {
  let nav = 0n,
    readable = complete,
    stale = false;
  for (const a of assets) {
    if (a.retired) continue;
    if (a.managed === undefined) {
      readable = false;
      continue;
    }
    if (a.managed === 0n) continue;
    if (!a.feedReadable || a.answer === undefined || a.answer <= 0n) {
      readable = false;
      continue;
    }
    nav += (a.managed * a.answer) / 100_000_000n;
    if (a.updatedAt === undefined || Number(a.updatedAt) > now)
      readable = false;
    else if (now - Number(a.updatedAt) > 26 * 3600) stale = true;
  }
  return { nav: readable ? nav : undefined, stale };
}
export function amount(value: string, allowZero = false) {
  if (!/^\d+(\.\d{1,18})?$/.test(value.trim()))
    throw new InputError(
      "Enter a decimal amount with up to 18 decimal places.",
    );
  const n = parseUnits(value.trim(), 18);
  if ((!allowZero && n === 0n) || n >= 2n ** 256n)
    throw new InputError(
      "Enter an amount greater than zero and within the supported range.",
    );
  return n;
}
export function address(value: string): Address {
  if (!isAddress(value.trim()) || value.trim().toLowerCase() === zeroAddress)
    throw new InputError("Enter a valid nonzero address.");
  return value.trim() as Address;
}
export function parseLaunch(input: string) {
  const lines = input
    .trim()
    .split(/\n/)
    .filter((s) => s.trim());
  if (!input.trim())
    throw new InputError(
      "Enter at least one TICKER tokenAddress feedAddress line.",
    );
  const parsed = lines.map((l, i) => {
    const parts = l.trim().split(/\s+/);
    if (parts.length !== 3)
      throw new InputError(
        `Line ${i + 1}: use TICKER tokenAddress feedAddress.`,
      );
    return {
      ticker: parts[0],
      token: address(parts[1]),
      feed: address(parts[2]),
    };
  });
  if (new Set(parsed.map((p) => p.token.toLowerCase())).size !== parsed.length)
    throw new InputError("Each stock must appear only once.");
  return parsed;
}
export function fmt(n: bigint | undefined, decimals = 18, digits = 4): string {
  if (n === undefined) return "unreadable";
  const raw = formatUnits(n, decimals);
  const [whole, frac = ""] = raw.split(".");
  const trimmed = frac.slice(0, digits).replace(/0+$/, "");
  if (n > 0n && BigInt(whole) === 0n && !trimmed && frac.replace(/0/g, ""))
    return `<0.${"0".repeat(digits - 1)}1`;
  return `${whole === "-0" ? "-0" : BigInt(whole).toLocaleString("en-US")}${trimmed ? "." + trimmed : ""}`;
}
export const exact = (n: bigint) => formatUnits(n, 18);
export const usd = (n: bigint | undefined) =>
  n === undefined ? "unreadable" : "$" + fmt(n, 18, 2);
export const date = (n: bigint | undefined) =>
  n === undefined
    ? "unreadable"
    : n === 0n
      ? "Not set"
      : new Date(Number(n) * 1000).toLocaleString("en-GB", {
          timeZone: "UTC",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }) + " UTC";
export function age(n: bigint | undefined, now = Date.now() / 1000) {
  if (n === undefined) return "unreadable";
  const s = Math.floor(now - Number(n));
  if (s < 0) return "Future timestamp";
  if (s < 60) return "Less than 1 min ago";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}
export const same = (a?: string, b?: string) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
export const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 600);
export const depositArgs = (t: Address, n: bigint, w: Address, q: bigint) =>
  [t, n, w, (q * 995n) / 1000n, deadline()] as const;
export const redeemArgs = (n: bigint, legs: bigint[]) =>
  [n, legs.map((a) => (a * 999n) / 1000n), deadline()] as const;
