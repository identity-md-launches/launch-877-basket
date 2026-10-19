import { isAddress, type Address, type Hex } from "viem";
import { encode, InputError, verifyItemTarget, type Spec } from "./chain";
import { KNOWN, LAUNCH, itemReady, type Launch } from "./itemConstants";
import { gaugeAbi, itemTokenAbi, itemRouterAbi, stakingAbi } from "./itemAbi";
import { RUNTIME_HASH } from "./deployment";
import { deadline } from "./model";

export const ITEM_ACTIONS = ["baskApprove", "baskStake", "baskWithdraw", "baskClaim", "ethApprove", "ethStake", "ethWithdraw", "ethClaim", "itemApprove", "itemStake", "itemUnstake", "claimBask", "baskLiquidityApprove", "usdgLiquidityApprove", "baskAddLiquidity", "itemLiquidityApprove", "ethAddLiquidity"] as const;
export type ItemAction = typeof ITEM_ACTIONS[number];
export type ItemLiquidity = { user: Address; matched: bigint; minimumA: bigint; minimumB: bigint; deadline: bigint };
export type ItemSpec = Spec & { itemAction: ItemAction; itemAmount?: bigint; itemHash: Hex; itemLiquidity?: ItemLiquidity };
// 2026-10-16, Add liquidity build: seventeen site actions; staking still claims only BASK.
export function itemSend(action: ItemAction, amount?: bigint, config: Launch = LAUNCH, liquidity?: ItemLiquidity): ItemSpec {
  if (!itemReady(config)) throw new InputError("ITEM figures: unreadable. Retry.");
  const amounts = ["baskApprove", "baskStake", "baskWithdraw", "ethApprove", "ethStake", "ethWithdraw", "itemApprove", "itemStake", "itemUnstake", "baskLiquidityApprove", "usdgLiquidityApprove", "baskAddLiquidity", "itemLiquidityApprove", "ethAddLiquidity"];
  if (amounts.includes(action) && (amount === undefined || amount <= 0n || amount >= 2n ** 256n)) throw new InputError("Enter an amount.");
  const adding = action === "baskAddLiquidity" || action === "ethAddLiquidity";
  if (adding && (!liquidity || !isAddress(liquidity.user) || /^0x0{40}$/i.test(liquidity.user) || liquidity.matched <= 0n || liquidity.matched >= 2n ** 256n || liquidity.minimumA <= 0n || liquidity.minimumB <= 0n || liquidity.minimumA !== amount! * 995n / 1000n || liquidity.minimumB !== liquidity.matched * 995n / 1000n || liquidity.deadline <= deadline() - 600n || liquidity.deadline > deadline())) throw new InputError("The request failed. Please retry.");
  if (!adding && liquidity !== undefined) throw new InputError("The request failed. Please retry.");
  const calls: Record<ItemAction, Omit<Spec, "itemAction" | "value" | "itemUser"> & { itemHash: Hex; value?: bigint; itemUser?: Address }> = {
    baskApprove: { address: KNOWN.BASK_USDG_PAIR, abi: itemTokenAbi, functionName: "approve", args: [config.BASK_USDG_GAUGE, amount], itemHash: config.BASK_USDG_PAIR_HASH },
    baskStake: { address: config.BASK_USDG_GAUGE, abi: gaugeAbi, functionName: "stake", args: [amount], itemHash: config.BASK_USDG_GAUGE_HASH },
    baskWithdraw: { address: config.BASK_USDG_GAUGE, abi: gaugeAbi, functionName: "withdraw", args: [amount], itemHash: config.BASK_USDG_GAUGE_HASH },
    baskClaim: { address: config.BASK_USDG_GAUGE, abi: gaugeAbi, functionName: "claim", args: [], itemHash: config.BASK_USDG_GAUGE_HASH },
    ethApprove: { address: config.ITEM_WETH_PAIR, abi: itemTokenAbi, functionName: "approve", args: [config.ITEM_ETH_GAUGE, amount], itemHash: config.ITEM_WETH_PAIR_HASH },
    ethStake: { address: config.ITEM_ETH_GAUGE, abi: gaugeAbi, functionName: "stake", args: [amount], itemHash: config.ITEM_ETH_GAUGE_HASH },
    ethWithdraw: { address: config.ITEM_ETH_GAUGE, abi: gaugeAbi, functionName: "withdraw", args: [amount], itemHash: config.ITEM_ETH_GAUGE_HASH },
    ethClaim: { address: config.ITEM_ETH_GAUGE, abi: gaugeAbi, functionName: "claim", args: [], itemHash: config.ITEM_ETH_GAUGE_HASH },
    itemApprove: { address: config.ITEM, abi: itemTokenAbi, functionName: "approve", args: [config.ITEM_STAKING, amount], itemHash: config.ITEM_HASH },
    itemStake: { address: config.ITEM_STAKING, abi: stakingAbi, functionName: "stake", args: [amount], itemHash: config.ITEM_STAKING_HASH },
    itemUnstake: { address: config.ITEM_STAKING, abi: stakingAbi, functionName: "unstake", args: [amount], itemHash: config.ITEM_STAKING_HASH },
    claimBask: { address: config.ITEM_STAKING, abi: stakingAbi, functionName: "claim", args: [KNOWN.BASK], itemHash: config.ITEM_STAKING_HASH },
    baskLiquidityApprove: { address: KNOWN.BASK, abi: itemTokenAbi, functionName: "approve", args: [KNOWN.V2_ROUTER, amount], itemHash: RUNTIME_HASH },
    usdgLiquidityApprove: { address: KNOWN.USDG, abi: itemTokenAbi, functionName: "approve", args: [KNOWN.V2_ROUTER, amount], itemHash: KNOWN.USDG_HASH },
    baskAddLiquidity: { address: KNOWN.V2_ROUTER, abi: itemRouterAbi, functionName: "addLiquidity", args: [KNOWN.BASK, KNOWN.USDG, amount, liquidity?.matched, liquidity?.minimumA, liquidity?.minimumB, liquidity?.user, liquidity?.deadline], itemHash: KNOWN.V2_ROUTER_HASH, itemUser: liquidity?.user },
    itemLiquidityApprove: { address: config.ITEM, abi: itemTokenAbi, functionName: "approve", args: [KNOWN.V2_ROUTER, amount], itemHash: config.ITEM_HASH },
    ethAddLiquidity: { address: KNOWN.V2_ROUTER, abi: itemRouterAbi, functionName: "addLiquidityETH", args: [config.ITEM, amount, liquidity?.minimumA, liquidity?.minimumB, liquidity?.user, liquidity?.deadline], value: liquidity?.matched, itemHash: KNOWN.V2_ROUTER_HASH, itemUser: liquidity?.user },
  };
  if (!ITEM_ACTIONS.includes(action)) throw new InputError("The request failed. Please retry.");
  return { ...calls[action], itemAction: action, itemAmount: amount, ...(adding ? { itemLiquidity: liquidity } : {}) };
}
export async function checkItemSend(spec: Spec) {
  const supplied = spec as ItemSpec;
  const expected = itemSend(supplied.itemAction, supplied.itemAmount, LAUNCH, supplied.itemLiquidity);
  if (supplied.address !== expected.address || supplied.itemHash !== expected.itemHash || supplied.value !== expected.value || supplied.itemUser !== expected.itemUser || encode(supplied) !== encode(expected)) throw new InputError("The request failed. Please retry.");
  await verifyItemTarget(expected.address, expected.itemHash);
}
// ITEM errors never pass through the vault ABI or vault error vocabulary.
// SPEC 4: the site's own send-flow words are reused as they are (Claude, 2026-10-15, review fix).
const SEND_FLOW_WORDS = [
  "Connect a wallet to send this transaction.",
  "Switch your wallet to Robinhood Chain (4663) before sending.",
  "The wallet account changed. Please retry.",
  "The wallet chain changed. Please retry.",
  "The transaction reverted. Refresh the data before retrying.",
];
export function itemError(error: unknown): string {
  if (error instanceof InputError) return error.message;
  if (error instanceof Error && SEND_FLOW_WORDS.includes(error.message)) return error.message;
  const e = error as { code?: number; message?: string };
  if (e.code === 4001 || /rejected|denied/i.test(e.message ?? "")) return "The wallet request was declined. You can try again.";
  return "The request failed. Please retry.";
}
