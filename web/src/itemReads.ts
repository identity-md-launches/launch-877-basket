import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Address } from "viem";
import { client, many, type Spec } from "./chain";
import { KNOWN, LAUNCH, itemReady, type Launch } from "./itemConstants";
import { gaugeAbi, itemPairAbi, itemTokenAbi, stakingAbi } from "./itemAbi";

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
export function useItemFigures(view: ItemView, account?: Address) {
  const [figures, setFigures] = useState<ItemFigures | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  const [scope, setScope] = useState("");
  const currentScope = view + ":" + (account ?? "");
  const liveScope = useRef<string | undefined>(currentScope);
  useLayoutEffect(() => { liveScope.current = currentScope; return () => { liveScope.current = undefined; }; }, [currentScope]);
  const refresh = useCallback(async (): Promise<void> => {
    if (liveScope.current !== view + ":" + (account ?? "")) return shownRefresh === refresh ? undefined : shownRefresh?.();
    const current = ++revision.current;
    if (!itemReady()) return;
    setLoading(true); setFailed(false);
    try {
      const next = await readItemFigures(view, account);
      if (revision.current === current) { setFigures(next); setScope(view + ":" + (account ?? "")); }
    } catch {
      if (revision.current === current) { setFailed(true); setFigures(null); }
    } finally {
      if (revision.current === current) setLoading(false);
    }
  }, [view, account]);
  useLayoutEffect(() => { shownRefresh = refresh; return () => { if (shownRefresh === refresh) shownRefresh = undefined; }; }, [refresh]);
  useEffect(() => {
    void refresh();
    return () => { revision.current++; };
  }, [refresh]);
  return { figures: scope === currentScope ? figures : null, failed, loading, refresh };
}
