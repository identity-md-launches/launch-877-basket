import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { client, many, feed, type Spec } from "./chain";
import { KNOWN, LAUNCH, PRICE_FEEDS, itemReady, type Launch } from "./itemConstants";
import { gaugeAbi, itemPairAbi, itemTokenAbi, stakingAbi } from "./itemAbi";
import { poolUsdPrice } from "./itemFormat";

export type ItemView = "earn";
export type ItemFigures = Record<string, bigint | boolean | Address>;
export async function readItemFigures(view: ItemView, account?: Address, config: Launch = LAUNCH, reader: typeof many = many, balanceReader: (account: Address) => Promise<bigint> = account => client.getBalance({ address: account })): Promise<ItemFigures | null> {
  if (!itemReady(config)) return null;
  const specs: [string, Spec][] = [];
  const add = (key: string, address: Address, abi: Spec["abi"], functionName: string, args: readonly unknown[] = []) => specs.push([key, { address, abi, functionName, args }]);
  for (const [prefix, address, pair] of [["bask", config.BASK_USDG_GAUGE, KNOWN.BASK_USDG_PAIR], ["eth", config.ITEM_ETH_GAUGE, config.ITEM_WETH_PAIR]] as const) {
    for (const name of ["started", "pair", "totalStaked", "released", "remaining", "rate"]) add(prefix + "." + name, address, gaugeAbi, name);
    if (account) {
      for (const name of ["staked", "earned"]) add(prefix + "." + name, address, gaugeAbi, name, [account]);
      add(prefix + ".balance", pair, itemTokenAbi, "balanceOf", [account]);
      add(prefix + ".allowance", pair, itemTokenAbi, "allowance", [account, address]);
    }
    for (const name of ["getReserves", "token0", "totalSupply"]) add(prefix + "." + (name === "totalSupply" ? "poolSupply" : name), pair, itemPairAbi, name);
  }
  add("staking.totalStaked", config.ITEM_STAKING, stakingAbi, "totalStaked");
  add("staking.pot", KNOWN.BASK, itemTokenAbi, "balanceOf", [config.ITEM_STAKING]);
  if (account) {
    add("staking.staked", config.ITEM_STAKING, stakingAbi, "staked", [account]);
    add("staking.balance", config.ITEM, itemTokenAbi, "balanceOf", [account]);
    add("staking.allowance", config.ITEM, itemTokenAbi, "allowance", [account, config.ITEM_STAKING]);
    add("staking.BASK", config.ITEM_STAKING, stakingAbi, "earned", [account, KNOWN.BASK]);
    for (const [prefix, side, token] of [["bask", "token", KNOWN.BASK], ["bask", "quote", KNOWN.USDG], ["eth", "token", config.ITEM]] as const) {
      if (token !== config.ITEM) add(prefix + "." + side + "Balance", token, itemTokenAbi, "balanceOf", [account]);
      add(prefix + "." + side + "Allowance", token, itemTokenAbi, "allowance", [account, KNOWN.V2_ROUTER]);
    }
  }
  // 2026-10-16, Add liquidity build: one Earn read batch, including eth_getBalance.
  const [results, native] = await Promise.all([reader(specs.map(([, spec]) => spec)), account ? balanceReader(account).catch(() => undefined) : undefined]);
  // 2026-10-17, pre-launch review: a failed or malformed result leaves its key absent (the page shows it as unavailable and
  // turns off only the actions that need it); the whole read fails only when no contract read succeeded.
  const figures: ItemFigures = Object.fromEntries(results.flatMap((result, i): [string, bigint | boolean | Address][] => {
    if (!result.ok) return [];
    const name = specs[i][1].functionName;
    if (name === "getReserves") {
      if (!Array.isArray(result.value) || result.value.length !== 3 || typeof result.value[0] !== "bigint" || typeof result.value[1] !== "bigint" || typeof result.value[2] !== "number") return [];
      const prefix = specs[i][0].split(".")[0];
      return [[prefix + ".reserve0", result.value[0]], [prefix + ".reserve1", result.value[1]]];
    }
    const expected = name === "started" || name === "funded" ? "boolean" : name === "pair" || name === "token0" ? "string" : "bigint";
    if (typeof result.value !== expected) return [];
    return [[specs[i][0], result.value as bigint | boolean | Address]];
  }));
  if (account) {
    if (typeof native === "bigint") figures["eth.quoteBalance"] = native;
    if (figures["staking.balance"] !== undefined) figures["eth.tokenBalance"] = figures["staking.balance"];
  }
  if (!results.some(result => result.ok)) throw new Error("ITEM figures: unreadable. Retry.");
  return figures;
}
// 2026-10-17, round-4 review: the refresh of the Earn figures on screen. A refresh kept by a send whose page was left or whose
// account changed runs this one instead, so the figures on screen are read again and nothing of the earlier page or account stays.
let shownRefresh: (() => Promise<void>) | undefined;
export function useItemFigures(view: ItemView | "prices", account?: Address, route = view as string) {
  const [figures, setFigures] = useState<ItemFigures | null>(null);
  const [prices, setPrices] = useState<PoolPrices | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  const [scope, setScope] = useState("");
  const currentScope = view + ":" + (account ?? "") + ":" + route;
  const liveScope = useRef<string | undefined>(currentScope);
  useLayoutEffect(() => { liveScope.current = currentScope; return () => { liveScope.current = undefined; }; }, [currentScope]);
  const refresh = useCallback(async (): Promise<void> => {
    if (liveScope.current !== view + ":" + (account ?? "") + ":" + route) return shownRefresh === refresh ? undefined : shownRefresh?.();
    const current = ++revision.current;
    setPrices(null);
    if (!itemReady()) return;
    setLoading(true); setFailed(false);
    try {
      const next = view === "earn" ? await readItemFigures(view, account) : null;
      const nextPrices = await readPoolPrices(view === "earn" ? next ?? {} : undefined);
      if (revision.current === current) { setFigures(next); setPrices(nextPrices); setScope(view + ":" + (account ?? "") + ":" + route); }
    } catch {
      if (revision.current === current) { setFailed(true); setFigures(null); setPrices(null); }
    } finally {
      if (revision.current === current) setLoading(false);
    }
  }, [view, account, route]);
  useLayoutEffect(() => { shownRefresh = refresh; return () => { if (shownRefresh === refresh) shownRefresh = undefined; }; }, [refresh]);
  useEffect(() => {
    void refresh();
    return () => { revision.current++; };
  }, [refresh]);
  return { figures: scope === currentScope ? figures : null, prices: scope === currentScope ? prices : null, failed, loading, refresh };
}

export type PoolPrices = { bask?: bigint; item?: bigint; baskUpdatedAt?: bigint; itemUpdatedAt?: bigint };
// Earn reuses its just-read reserves; the shared header reads only pairs and feeds elsewhere.
// No module cache, wallet access, polling, or fallback to an earlier quote.
export async function readPoolPrices(figures?: ItemFigures, config: Launch = LAUNCH, reader: typeof many = many, now = BigInt(Math.floor(Date.now() / 1000))): Promise<PoolPrices> {
  if (!itemReady(config)) return {};
  const specs: Spec[] = [];
  for (const pair of [KNOWN.BASK_USDG_PAIR, config.ITEM_WETH_PAIR]) {
    if (!figures) for (const functionName of ["getReserves", "token0"]) specs.push({ address: pair, abi: itemPairAbi, functionName, args: [] });
  }
  for (const address of [PRICE_FEEDS.USDG, PRICE_FEEDS.ETH]) for (const name of ["latestRoundData", "decimals"]) specs.push(feed(address, name));
  const results = await reader(specs).catch(() => []);
  const value = (index: number) => results[index]?.ok ? results[index].value : undefined;
  const prices: PoolPrices = {};
  for (const [i, prefix, token, quote, quoteDecimals, key] of [[0, "bask", KNOWN.BASK, KNOWN.USDG, 6, "bask"], [1, "eth", config.ITEM, KNOWN.WETH, 18, "item"]] as const) {
    const reserves = figures ? [figures[prefix + ".reserve0"], figures[prefix + ".reserve1"]] : value(i * 2);
    const token0 = figures ? figures[prefix + ".token0"] : value(i * 2 + 1);
    const round = value((figures ? 0 : 4) + i * 2), decimals = value((figures ? 0 : 4) + i * 2 + 1);
    prices[key] = poolUsdPrice(reserves, token0, token, quote, quoteDecimals, round, decimals, now);
    if (prices[key] !== undefined) prices[key === "bask" ? "baskUpdatedAt" : "itemUpdatedAt"] = round[3];
  }
  return prices;
}
