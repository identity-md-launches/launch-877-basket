import {
  encodeAbiParameters,
  decodeAbiParameters,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import {
  read,
  vault,
  token,
  feed,
  zeroAddress,
  InputError,
  proposalKinds,
} from "./chain";
import {
  address,
  recipient,
  amount,
  uint,
  same,
  cleanFeedDescription,
  pairingMatches,
  parseLaunch,
  utcTime,
  usd,
} from "./model";
export const settingNames = [
  "Band",
  "MaxAge",
  "NoPoolAge",
  "FreshCount",
  "FreshHours",
  "Hours",
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
  "00:00:00–24:00:00 UTC; from < to, or both zero for all hours",
  "300–86,400 seconds",
  "50–2,000 basis points",
  "20,000–500,000",
  "20,000–500,000",
  "20,000–500,000",
  "20,000–500,000",
  "20,000–500,000",
  "At least assetCount; maxAssets × (balanceGas + 60,000) ≤ 28,000,000",
  "directLimit × (balanceGas + payGas + 70,000) ≤ 28,000,000; zero disables direct attempts",
];
const payloadTypes = [
  ["address", "address", "address", "uint128"],
  ["address"],
  [],
  [],
  [],
  ["address", "address", "uint128"],
  [],
  ["address"],
  ["uint256"],
  ["address"],
  ["uint8", "uint256"],
];
export function poolValues(v: Record<string, string>) {
  const p = address(v.pool, true),
    q = address(v.quoteFeed, true),
    l = uint(v.minLiquidity, 128);
  if (same(p, zeroAddress) && (!same(q, zeroAddress) || l !== 0n))
    throw new InputError(
      "No pool requires zero quote feed and zero liquidity.",
    );
  if (!same(p, zeroAddress) && same(q, zeroAddress))
    throw new InputError("A pool requires its quote feed.");
  return [p, q, l] as const;
}
export function parseTime(v: string) {
  if (
    !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v) &&
    !/^24:00(?::00)?$/.test(v)
  )
    throw new InputError("Use UTC HH:MM or HH:MM:SS, up to 24:00:00.");
  const [h, m, s = 0] = v.split(":").map(Number);
  return BigInt(h * 3600 + m * 60 + s);
}
export function proposalSpec(action: number, v: Record<string, string>) {
  let values: unknown[] = [];
  switch (action) {
    case 0:
      values = [address(v.feed), ...poolValues(v)];
      break;
    case 1:
      values = [address(v.feed)];
      break;
    case 5:
      values = [...poolValues(v)];
      break;
    case 7:
      values = [address(v.next)];
      break;
    case 8:
      values = [amount(v.cap)];
      break;
    case 9:
      values = [recipient(v.recipient)];
      break;
    case 10: {
      const key = Number(v.setting ?? "0");
      if (!settingNames[key]) throw new InputError("Choose a setting.");
      let value = uint(v.value || "0");
      if (key === 5) {
        const from = parseTime(v.from),
          to = parseTime(v.to);
        if ((from !== 0n || to !== 0n) && (from >= to || to > 86400n))
          throw new InputError(
            "Use from < to, or zero for both to open at all hours.",
          );
        value = (from << 32n) | to;
      }
      values = [key, value];
    }
  }
  const data = values.length
    ? encodeAbiParameters(
        payloadTypes[action].map((type) => ({ type })),
        values,
      )
    : "0x";
  return vault("propose", [
    action,
    action >= 7 ? zeroAddress : address(v.token),
    data,
  ]);
}
export function proposalWords(action: number, data: Hex) {
  try {
    const types = payloadTypes[action];
    const v = types.length
      ? decodeAbiParameters(
          types.map((type) => ({ type })),
          data,
        )
      : [];
    switch (action) {
      case 0:
        return `Feed ${v[0]}; pool ${v[1]}; quote feed ${v[2]}; minimum liquidity ${v[3]}`;
      case 1:
        return `New feed ${v[0]}`;
      case 2:
        return "Re-centre the band at the feed answer at execution.";
      case 3:
        return "Reopen this stock for deposits.";
      case 4:
        return "Retire permanently; zero in deposit NAV, still paid on redemption.";
      case 5:
        return `Pool ${v[0]}; quote feed ${v[1]}; minimum liquidity ${v[2]}`;
      case 6:
        return "Add positive excess to managed holdings. Keep deposits paused until executed and checked.";
      case 7:
        return `New guardian ${v[0]}`;
      case 8:
        return `New size limit ${usd(v[0] as bigint)}`;
      case 9:
        return `Fee recipient ${v[0]}. Fees begin when executed; the recipient can never be unset.`;
      case 10: {
        const k = Number(v[0]),
          n = v[1] as bigint;
        return k === 5
          ? `hoursFrom ${utcTime(n >> 32n)}, hoursTo ${utcTime(n & 0xffffffffn)} UTC`
          : `${settingFields[k]} = ${n}`;
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
]);
export type Listing = ReturnType<typeof parseLaunch>[number];
export type Pairing = Listing & {
  symbol: string;
  description: string;
  price: bigint;
  feedDecimals: number;
  poolSymbols: string;
  quoteName: string;
  listed: boolean;
  marked: boolean;
  error?: string;
};
export async function inspectListing(row: Listing): Promise<Pairing> {
  const [symbol, description, price, decimals, config] = await Promise.all([
    read(token(row.token, "symbol")),
    read(feed(row.feed, "description")),
    read(feed(row.feed, "latestRoundData")),
    read(feed(row.feed, "decimals")),
    read(vault("asset", [row.token])),
  ]);
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
  }
  const cleaned = cleanFeedDescription(description, symbol);
  return {
    ...row,
    symbol,
    description: cleaned,
    price: price[1],
    feedDecimals: Number(decimals),
    poolSymbols,
    quoteName,
    listed: !same(config.token, zeroAddress),
    marked: row.ticker !== symbol || !pairingMatches(symbol, cleaned),
  };
}
export { proposalKinds };
