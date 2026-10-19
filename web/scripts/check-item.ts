import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { encodeFunctionData, getAddress, isAddress, parseAbi, type Address, type Hex } from "viem";
import { KNOWN, LAUNCH, ADDRESS_KEYS, HASH_KEYS, itemReady, type ReadyLaunch } from "../src/itemConstants";
import { itemAmount, itemShare, itemRewardUsd, itemLiquidityQuote, itemRatioAmount, parseItemAmount } from "../src/itemFormat";
import { ITEM_ACTIONS, itemSend, itemError } from "../src/itemActions";
import { InputError, type Spec } from "../src/chain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StakeCard } from "../src/Earn";
import type { Wallet } from "../src/wallet";
import type { ItemFigures } from "../src/itemReads";
import { deadline } from "../src/model";
import { readItemFigures } from "../src/itemReads";
import { ADDRESSES } from "../src/tokenomicsData";
import { hasAddresses } from "../src/Tokenomics";

let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log("PASS", name); }
const address = (n: number) => getAddress("0x" + BigInt(n).toString(16).padStart(40, "0"));
const config = Object.fromEntries([...ADDRESS_KEYS.map((key, i) => [key, address(i + 100)]), ...HASH_KEYS.map((key, i) => [key, "0x" + BigInt(i + 200).toString(16).padStart(64, "0")]), ["ITEM_REPO", "https://github.com/example/item"], ["ITEM_COMMIT", "a".repeat(40)]]) as ReadyLaunch;
check("all known addresses checksummed", () => {
  assert.equal(Object.keys(KNOWN).length, 10);
  assert.equal(createHash("sha256").update(JSON.stringify(KNOWN)).digest("hex"), "af7a83634bad6afc72627d5ebb29577edbcdee5049e39a847a0876f3ffcf094c");
  for (const [key, value] of Object.entries(KNOWN)) if (key.endsWith("_HASH")) assert.match(value, /^0x[0-9a-f]{64}$/); else assert.equal(getAddress(value), value);
});
check("launch slots null or checksummed, hashes exact length", () => {
  for (const key of ADDRESS_KEYS) if (LAUNCH[key] !== null) assert.equal(getAddress(LAUNCH[key]!), LAUNCH[key]);
  for (const key of HASH_KEYS) if (LAUNCH[key] !== null) assert.match(LAUNCH[key]!, /^0x[0-9a-f]{64}$/);
  assert.equal(hasAddresses(ADDRESSES), itemReady());
});
check("format zero, thousands and full pool precision", () => {
  assert.equal(itemAmount(0n), "0");
  assert.equal(itemAmount(1234567890123456789012n), "1,234.56789");
  assert.equal(itemAmount(45000000000001n, 18, true), "0.000045000000000001");
  assert.equal(itemAmount(1n, 18, true), "0.000000000000000001");
  assert.equal(itemAmount(1n, 6), "0.000001");
  for (const value of [1n, 999999n, 999999999999n]) assert.equal(itemAmount(value), "<0.000001");
  assert.equal(itemShare(1n, 10n ** 27n), "<0.000001%");
});
check("amount input never rounds and rejects invalid uint256", () => {
  assert.equal(parseItemAmount("0.000000000000000001"), 1n);
  for (const text of ["", "0", "-1", "1e18", "1.0000000000000000001", "1,000", (2n ** 256n).toString()]) assert.equal(parseItemAmount(text), undefined);
});
check("BASK reward dollar estimate uses earned times vault NAV divided by supply", () => {
  const unit = 10n ** 18n;
  assert.equal(itemRewardUsd(25n * unit, 5000n * unit, 1000n * unit), "$125.00");
  assert.equal(itemRewardUsd(3n * unit, 100n * unit, 3n * unit), "$100.00");
  assert.equal(itemRewardUsd(1000000000000000000000000n, 1001n * unit, unit), "$1,001,000,000.00");
  assert.equal(itemRewardUsd(0n, 5000n * unit, 1000n * unit), "$0.00");
  assert.equal(itemRewardUsd(unit, 0n, unit), "$0.00");
});
check("BASK dollar estimate keeps small positive values visible without rounding up", () => {
  const unit = 10n ** 18n;
  assert.equal(itemRewardUsd(unit, 10000000000000000n, unit), "$0.01");
  assert.equal(itemRewardUsd(unit, 19999999999999999n, unit), "$0.01");
  assert.equal(itemRewardUsd(1n, unit, unit), "<$0.01");
  assert.equal(itemRewardUsd(1n, 1n, 10n ** 30n), "<$0.01");
});
check("unreadable NAV or supply and zero supply never invent a dollar value", () => {
  const unit = 10n ** 18n;
  assert.equal(itemRewardUsd(unit, undefined, unit), "Unavailable");
  assert.equal(itemRewardUsd(unit, unit, undefined), "Unavailable");
  assert.equal(itemRewardUsd(unit, unit, 0n), "Unavailable");
});
check("v2 quote, 0.5% minimums and pool-token estimate round down", () => {
  assert.deepEqual(itemLiquidityQuote(101n, 300n, 200n, 30n), { matched: 67n, minimumA: 100n, minimumB: 66n, poolTokens: 10n });
  assert.deepEqual(itemLiquidityQuote(2n, 3n, 7n, 5n), { matched: 4n, minimumA: 1n, minimumB: 3n, poolTokens: 2n });
  assert.deepEqual(itemLiquidityQuote(10n ** 18n, 3n * 10n ** 18n, 10n * 10n ** 6n, 1000000000000n), { matched: 3333333n, minimumA: 995000000000000000n, minimumB: 3316666n, poolTokens: 333333300000n });
});
check("empty pools and amounts below a positive router minimum refuse", () => {
  for (const [a, b, supply] of [[0n, 10n, 10n], [10n, 0n, 10n], [10n, 10n, 0n]]) assert.throws(() => itemLiquidityQuote(10n, a, b, supply), /Pool not seeded yet/);
  for (const amount of [0n, 1n, -1n, 2n ** 256n]) assert.throws(() => itemLiquidityQuote(amount, 10n, 10n, 10n));
});
check("daily rewards use the current rate and stake share without prices", () => {
  const unit = 10n ** 18n, rate = unit, total = 100n * unit;
  assert.equal(itemRatioAmount(rate * 86400n * unit, total), "864");
  assert.equal(itemRatioAmount(rate * 86400n * 10n * unit, total), "8,640");
  assert.equal(itemRatioAmount(rate * 86400n * unit, 0n), "0");
  assert.equal(itemRatioAmount(1n, 10n ** 30n), "<0.000001");
});
check("fee-pot shares preserve the owner's one, two and three-staker examples", () => {
  const unit = 10n ** 18n, pot = 10n * unit, stake = 100n * unit;
  assert.equal(itemRatioAmount(pot * stake, stake), "10");
  assert.equal(itemShare(stake, stake), "100%");
  assert.equal(itemRatioAmount(pot * stake, 2n * stake), "5");
  assert.equal(itemShare(stake, 2n * stake), "50%");
  assert.equal(itemRatioAmount(pot * stake, 4n * stake), "2.5");
  assert.equal(itemRatioAmount(pot * 2n * stake, 4n * stake), "5");
  assert.equal(itemShare(stake, 4n * stake), "25%");
});
const abi = parseAbi(["function approve(address,uint256) returns (bool)", "function stake(uint256)", "function withdraw(uint256)", "function claim()", "function claim(address)", "function unstake(uint256)", "function addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256) returns (uint256,uint256,uint256)", "function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns (uint256,uint256,uint256)"]);
const amount = 45000000000001n;
const liquidity = { user: address(1), matched: 90000000000002n, minimumA: 44775000000000n, minimumB: 89550000000001n, deadline: deadline() };
const expected: [Address, string, readonly unknown[]][] = [
  [KNOWN.BASK_USDG_PAIR, "approve", [config.BASK_USDG_GAUGE, amount]],
  [config.BASK_USDG_GAUGE, "stake", [amount]], [config.BASK_USDG_GAUGE, "withdraw", [amount]], [config.BASK_USDG_GAUGE, "claim", []],
  [config.ITEM_WETH_PAIR, "approve", [config.ITEM_ETH_GAUGE, amount]],
  [config.ITEM_ETH_GAUGE, "stake", [amount]], [config.ITEM_ETH_GAUGE, "withdraw", [amount]], [config.ITEM_ETH_GAUGE, "claim", []],
  [config.ITEM, "approve", [config.ITEM_STAKING, amount]],
  [config.ITEM_STAKING, "stake", [amount]], [config.ITEM_STAKING, "unstake", [amount]],
  [config.ITEM_STAKING, "claim", [KNOWN.BASK]],
  [KNOWN.BASK, "approve", [KNOWN.V2_ROUTER, amount]],
  [KNOWN.USDG, "approve", [KNOWN.V2_ROUTER, amount]],
  [KNOWN.V2_ROUTER, "addLiquidity", [KNOWN.BASK, KNOWN.USDG, amount, liquidity.matched, liquidity.minimumA, liquidity.minimumB, liquidity.user, liquidity.deadline]],
  [config.ITEM, "approve", [KNOWN.V2_ROUTER, amount]],
  [KNOWN.V2_ROUTER, "addLiquidityETH", [config.ITEM, amount, liquidity.minimumA, liquidity.minimumB, liquidity.user, liquidity.deadline]],
];
for (const [i, action] of ITEM_ACTIONS.entries()) check("send " + (i + 1) + ": " + action, () => {
  const spec = itemSend(action, amount, config, action.endsWith("AddLiquidity") ? liquidity : undefined);
  const [target, functionName, args] = expected[i];
  assert.equal(spec.address, target);
  assert.equal(encodeFunctionData(spec as any), encodeFunctionData({ abi, functionName, args } as any));
  assert.equal(spec.itemAmount, amount);
  assert.match(spec.itemHash, /^0x[0-9a-f]{64}$/);
  assert.equal(spec.value, action === "ethAddLiquidity" ? liquidity.matched : undefined);
  assert.equal(spec.itemUser, action.endsWith("AddLiquidity") ? liquidity.user : undefined);
});
check("exactly seventeen actions; optional-token claims and invalid or zero amounts refused", () => {
  assert.equal(ITEM_ACTIONS.length, 17);
  assert.throws(() => itemSend("sync" as any, amount, config));
  assert.throws(() => itemSend("claimUsdg" as any, amount, config));
  assert.throws(() => itemSend("claimWeth" as any, amount, config));
  assert.throws(() => itemSend("itemApprove", 0n, config));
  assert.throws(() => itemSend("itemStake", 2n ** 256n, config));
  for (const action of ["removeLiquidity", "swapExactTokensForTokens", "approveUnlimited"]) assert.throws(() => itemSend(action as any, amount, config));
  for (const action of ["baskAddLiquidity", "ethAddLiquidity"] as const) {
    assert.throws(() => itemSend(action, amount, config));
    assert.throws(() => itemSend(action, amount, config, { ...liquidity, minimumA: 0n }));
    assert.throws(() => itemSend(action, amount, config, { ...liquidity, minimumB: 0n }));
    assert.throws(() => itemSend(action, amount, config, { ...liquidity, deadline: deadline() + 2n })); // 2026-10-16, Claude check: +2 so a clock tick between the two deadline() calls cannot void the case; the gate tests +1 on a frozen clock.
    assert.throws(() => itemSend(action, amount, config, { ...liquidity, deadline: 0n }));
  }
});
for (const key of Object.keys(config)) {
  const partial = { ...config, [key]: null };
  check("null " + key + " disables readiness and every send", () => {
    assert.equal(itemReady(partial), false);
    for (const action of ITEM_ACTIONS) assert.throws(() => itemSend(action, amount, partial, action.endsWith("AddLiquidity") ? liquidity : undefined));
  });
  for (const view of ["earn"] as const) {
    let reads = 0;
    assert.equal(await readItemFigures(view, address(1), partial, async () => { reads++; return []; }, async () => { reads++; return 1n; }), null);
    assert.equal(reads, 0); checks++;
  }
}
for (const view of ["earn"] as const) {
  let calls = 0, balances = 0;
  const figures = await readItemFigures(view, address(1), config, async specs => {
    calls++;
    for (const spec of specs) {
      assert.ok(isAddress(spec.address));
      assert.ok(!["start", "fund", "release", "sync"].includes(spec.functionName));
    }
    if (view === "earn") {
      const stakingRewards = specs.filter(spec => spec.address === config.ITEM_STAKING && spec.functionName === "earned");
      assert.deepEqual(stakingRewards.map(spec => spec.args), [[address(1), KNOWN.BASK]], "Earn reads BASK rewards only; USD is a valuation, not another reward token");
      assert.equal(specs.length, 37);
      assert.equal(specs.filter(spec => spec.address === config.ITEM && spec.functionName === "balanceOf").length, 1, "reuse the existing ITEM wallet balance");
      assert.deepEqual(specs.filter(spec => spec.address === KNOWN.BASK && spec.functionName === "balanceOf").map(spec => spec.args), [[config.ITEM_STAKING], [address(1)]]);
    }
    return specs.map(spec => ({ ok: true, value: spec.functionName === "getReserves" ? [3n, 7n, 1] : ["started", "funded"].includes(spec.functionName) ? true : ["pair", "token0"].includes(spec.functionName) ? KNOWN.BASK_USDG_PAIR : 1n }));
  }, async account => { assert.equal(account, address(1)); balances++; return 9n; });
  assert.equal(calls, 1); assert.equal(balances, 1);
  assert.equal(figures?.["eth.quoteBalance"], 9n); assert.equal(figures?.["eth.tokenBalance"], figures?.["staking.balance"]); assert.equal(figures?.["bask.reserve0"], 3n); assert.equal(figures?.["bask.reserve1"], 7n); checks++;
}
// 2026-10-17, pre-launch review: a failed leg leaves only its own key absent; the whole read fails only when nothing was readable.
const fakeValue = (spec: Spec) => spec.functionName === "getReserves" ? [3n, 7n, 1] : ["started", "funded"].includes(spec.functionName) ? true : ["pair", "token0"].includes(spec.functionName) ? KNOWN.BASK_USDG_PAIR : 1n;
const fakeReader = (fail: (spec: Spec) => boolean) => async (specs: Spec[]) => specs.map(spec => fail(spec) ? { ok: false as const, error: "unreadable" } : { ok: true as const, value: fakeValue(spec) });
const partial = await readItemFigures("earn", address(1), config, fakeReader(spec => spec.address === KNOWN.USDG && spec.functionName === "allowance"), async () => 9n);
assert.equal(partial?.["bask.quoteAllowance"], undefined); assert.equal(partial?.["bask.balance"], 1n); assert.equal(partial?.["staking.staked"], 1n); assert.equal(partial?.["eth.quoteBalance"], 9n); assert.equal(Object.keys(partial ?? {}).length, 40, "40 of the 41 keys of a complete read");
checks++; console.log("PASS one failed read leaves only its own key absent");
const noReserves = await readItemFigures("earn", address(1), config, fakeReader(spec => spec.functionName === "getReserves" && spec.address === KNOWN.BASK_USDG_PAIR), async () => 9n);
assert.equal(noReserves?.["bask.reserve0"], undefined); assert.equal(noReserves?.["bask.reserve1"], undefined); assert.equal(noReserves?.["eth.reserve0"], 3n);
checks++; console.log("PASS a failed reserves read leaves both reserve keys absent");
const noNative = await readItemFigures("earn", address(1), config, fakeReader(() => false), async () => { throw new Error("balance unreadable"); });
assert.equal(noNative?.["eth.quoteBalance"], undefined); assert.equal(noNative?.["eth.tokenBalance"], 1n);
checks++; console.log("PASS a failed native balance read leaves the ETH balance absent and the rest present");
await assert.rejects(readItemFigures("earn", address(1), config, fakeReader(() => true), async () => 9n), /ITEM figures: unreadable\. Retry\./);
checks++; console.log("PASS nothing readable fails the whole read");
// The card shows Unavailable for an absent figure and turns off only the actions that need it; every ITEM action is off while a send is unresolved.
const full = await readItemFigures("earn", address(1), config, fakeReader(() => false), async () => 9n) as ItemFigures;
const fakeWallet = (unresolved?: Hex) => ({ account: address(1), chainId: 4663, busy: false, unresolved, progress: {}, itemPending: async () => unresolved, send: async () => undefined }) as unknown as Wallet;
const render = (prefix: "bask" | "staking", figures: ItemFigures, unresolved?: Hex) => renderToStaticMarkup(createElement(StakeCard, { prefix, figures, wallet: fakeWallet(unresolved), refresh: async () => undefined }));
const cell = (markup: string, key: string) => markup.match(new RegExp('data-figure="' + key.replace(".", "\\.") + '">([^<]*)<'))?.[1];
const without = (keys: string[]) => Object.fromEntries(Object.entries(full).filter(([key]) => !keys.includes(key))) as ItemFigures;
const reasons = (markup: string) => [...markup.matchAll(/<p class="disabled-reason">([^<]*)<\/p>/g)].map(m => m[1]);
const unreadable = "ITEM figures: unreadable. Retry.";
check("a complete read renders no Unavailable cell and no unreadable reason", () => {
  const markup = render("bask", full);
  assert.ok(!markup.includes("Unavailable")); assert.ok(!markup.includes(unreadable)); assert.equal(cell(markup, "bask.balance"), "0.000000000000000001 pool tokens");
});
check("an unreadable pool-token balance shows Unavailable and turns off staking only", () => {
  const markup = render("bask", without(["bask.balance"]));
  assert.equal(cell(markup, "bask.balance"), "Unavailable"); assert.equal(cell(markup, "bask.staked"), "0.000000000000000001 pool tokens");
  assert.ok(reasons(markup).includes(unreadable), "the stake reason names the unreadable figure");
  assert.ok(!markup.includes("More than your balance."), "no balance comparison against a missing figure");
  assert.ok(reasons(markup).includes("Enter an amount."), "withdraw keeps its ordinary reason");
  assert.ok(!markup.includes("Nothing to claim yet.") || markup.includes("Claim ITEM"), "claim keeps its own reason");
});
check("an unreadable gauge pair never reads as a mismatch and turns off staking only", () => {
  const markup = render("bask", without(["bask.pair"]));
  assert.ok(!markup.includes("This gauge's pool does not match the pool listed here."));
  assert.ok(reasons(markup).includes(unreadable)); assert.ok(reasons(markup).includes("Enter an amount."));
});
check("unreadable reserves turn off Add liquidity with the unreadable reason, never as an unseeded pool", () => {
  const markup = render("bask", without(["bask.reserve0", "bask.reserve1"]));
  assert.ok(reasons(markup).includes(unreadable)); assert.ok(!markup.includes("Pool not seeded yet."));
});
check("an unreadable staking reward shows Unavailable and turns off the claim with the unreadable reason", () => {
  const markup = render("staking", without(["staking.BASK"]));
  assert.equal(cell(markup, "staking.BASK"), "Unavailable"); assert.equal(cell(markup, "staking.estimatedBASK"), "Unavailable"); assert.equal(cell(markup, "staking.USDValue")?.startsWith("Unavailable"), true);
  assert.ok(reasons(markup).includes(unreadable)); assert.ok(!markup.includes("Nothing to claim yet."));
  assert.ok(reasons(markup).includes("Enter an amount."), "unstake keeps its ordinary reason");
});
check("an unresolved earlier send turns every action off with the pending reason", () => {
  for (const prefix of ["bask", "staking"] as const) {
    const markup = render(prefix, full, ("0x" + "ab".repeat(32)) as Hex);
    assert.ok(reasons(markup).every(reason => reason === "Another transaction is pending. Finish it in your wallet or wait for its receipt."), prefix + ": one reason everywhere");
    assert.ok(reasons(markup).length >= 2, prefix + ": the reason is shown");
    assert.ok(!markup.includes("Nothing to claim yet."));
  }
});
check("itemError keeps the site's send-flow words, the wallet refusal and nothing from the vault vocabulary", () => {
  assert.equal(itemError(new InputError("Enter an amount.")), "Enter an amount.");
  assert.equal(itemError(new Error("The wallet account changed. Please retry.")), "The wallet account changed. Please retry.");
  assert.equal(itemError(new Error("The transaction reverted. Refresh the data before retrying.")), "The transaction reverted. Refresh the data before retrying.");
  assert.equal(itemError(Object.assign(new Error("User rejected the request."), { code: 4001 })), "The wallet request was declined. You can try again.");
  assert.equal(itemError(new Error("DepositUnavailable")), "The request failed. Please retry.");
  assert.equal(itemError(new Error("execution reverted: InsufficientBalance")), "The request failed. Please retry.");
  assert.equal(itemError("boom"), "The request failed. Please retry.");
});
console.log(`PASS ${checks} ITEM unit checks; known-address digest ${createHash("sha256").update(JSON.stringify(KNOWN)).digest("hex")}`);
