import assert from "node:assert/strict";
import fs from "node:fs";
import {
  decodeFunctionData,
  encodeErrorResult,
  keccak256,
  toHex,
  type Address,
} from "viem";
import { ABI_HASH, RUNTIME_HASH } from "../src/deployment";
import {
  client,
  verifyNetwork,
  read,
  vault,
  vaultAbi,
  encode,
  explain,
  GAS,
  reasons,
  zeroAddress,
  VAULT,
} from "../src/chain";
import {
  amount,
  recipient,
  navOf,
  parseLaunch,
  depositArgs,
  redeemArgs,
  cleanFeedDescription,
  pairingMatches,
  loadSnapshot,
  type Asset,
} from "../src/model";
import { proposalSpec, proposalWords, type Action } from "../src/governance";
import { parseHours } from "../src/newYork";
const canonical = (v: any): any =>
  Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
assert.equal(keccak256(toHex(JSON.stringify(canonical(vaultAbi)))), ABI_HASH);
assert.equal(GAS, 30_000_000n);
assert.equal(reasons.length, 15);
assert.equal(client.ccipRead, false);
assert.equal(amount("1.25", false, 6), 1250000n);
assert.throws(() => amount("1.0000001", false, 6));
assert.throws(() => amount("1e18"));
assert.throws(() => recipient(zeroAddress));
assert.throws(() => recipient(VAULT));
const asset = {
  managed: 2n * 10n ** 6n,
  answer: 125n * 10n ** 10n,
  tokenDecimals: 6,
  feedDecimals: 10,
  retired: false,
  reason: 0,
} as Asset;
assert.equal(navOf([asset]).nav, 250n * 10n ** 18n);
assert.equal(navOf([{ ...asset, reason: 12 }]).indicative, true);
assert.equal(navOf([{ ...asset, reason: 0 }]).indicative, false);
assert.equal(navOf([{ ...asset, retired: true }]).nav, 0n);
assert.equal(navOf([{ ...asset, retired: true, reason: 12 }]).indicative, true);
assert.equal(navOf([{ ...asset, answer: 0n }]).nav, undefined);
assert.equal(navOf([{ ...asset, answer: undefined }]).nav, undefined);
assert.equal(navOf([asset], false).nav, undefined);
assert.equal(cleanFeedDescription("Robinhood FIG / USD"), "FIG / USD");
assert.equal(cleanFeedDescription("RHFIG / USD"), "FIG / USD");
assert.equal(pairingMatches("FIG", "FIG / USD"), true);
assert.equal(pairingMatches("FIG", "FIGS / USD"), false);
assert.deepEqual(parseHours("Sunday 8:00 pm", "Saturday 24:00"), [72000n, 604800n]);
assert.throws(() => parseHours("Monday 24:01", "Friday 4:00 pm"));
const network = await verifyNetwork(),
  block = await client.getBlockNumber();
assert.ok(block > 83448310n);
const snapshot = await loadSnapshot();
assert.deepEqual(snapshot.errors, []);
const owner = snapshot.globals.owner as Address,
  guardian = snapshot.globals.guardian as Address;
const deposit = depositArgs([VAULT], [100n], owner, 1000n);
assert.equal(deposit[3], 995n);
assert.equal(redeemArgs(100n, owner, [0n, 1000n, 3333n])[2][2], 3329n);
const values = {
  token: VAULT,
  feed: guardian,
  pool: zeroAddress,
  quoteFeed: zeroAddress,
  minLiquidity: "0",
  next: guardian,
  cap: "2000000",
  recipient: owner,
  setting: "5",
  from: "Monday 9:30 am",
  to: "Friday 4:00 pm",
};
const actions = [];
for (let i = 0; i < 11; i++) {
  const spec = proposalSpec(i, values);
  const d = decodeFunctionData({ abi: vaultAbi, data: encode(spec) });
  assert.equal(d.functionName, "propose");
  const a = d.args?.[0] as Action;
  assert.equal(Number(a.kind), i);
  assert.equal(
    String(a.token).toLowerCase(),
    i <= 6 ? VAULT : zeroAddress,
  );
  if (i === 10) assert.deepEqual([a.setting, a.value, a.value2], [5, 120600n, 489600n]);
  actions.push({ kind: i, action: a, words: proposalWords(a) });
}
const dstSpec = proposalSpec(10, { ...values, setting: "6", value: "1" });
const dstAction = decodeFunctionData({ abi: vaultAbi, data: encode(dstSpec) })
  .args?.[0] as Action;
assert.deepEqual([dstAction.setting, dstAction.value, dstAction.value2], [6, 1n, 0n]);
assert.match(proposalWords(dstAction), /never daylight saving/);
assert.throws(() => proposalSpec(10, { ...values, setting: "6", value: "3" }));
const always = decodeFunctionData({
  abi: vaultAbi,
  data: encode(proposalSpec(10, { ...values, from: "Always open", to: "Always open" })),
}).args?.[0] as Action;
assert.deepEqual([always.value, always.value2], [0n, 0n]);
assert.throws(() => parseLaunch(`FIG ${VAULT} ${guardian}`));
assert.equal(
  parseLaunch(`FIG ${VAULT} ${guardian} ${zeroAddress} ${zeroAddress} 0`)
    .length,
  1,
);
assert.match(
  explain({
    data: encodeErrorResult({ abi: vaultAbi, errorName: "CapExceeded" }),
  }),
  /size limit/,
);
assert.match(
  explain({
    data: encodeErrorResult({
      abi: vaultAbi,
      errorName: "DepositUnavailable",
      args: [12, zeroAddress],
    }),
  }),
  /pool check failed.*none/,
);
const status = await read(vault("depositStatus", [[]]));
fs.mkdirSync("../artifacts", { recursive: true });
fs.writeFileSync(
  "../artifacts/live-validation.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      block,
      vault: VAULT,
      runtimeHash: RUNTIME_HASH,
      abiHash: ABI_HASH,
      network,
      globals: snapshot.globals,
      assetCount: snapshot.assets.length,
      status,
      actions,
      checks: [
        "Decimal-normalized NAV and indicative flags",
        "All 11 proposal kinds encoded as the BaskVault.Action struct and decoded; Hours and Dst cases",
        "Exact deposit and redemption minimums",
        "Input, receiver, hours and listing validation",
        "Live chain, runtime hash, aggregate snapshot and status",
      ],
      limitations:
        "Read-only live checks. Successful wallet flows run separately on an isolated fork.",
    },
    (_, v) => (typeof v === "bigint" ? String(v) : v),
    2,
  ) + "\n",
);
console.log(
  "PASS: unit checks, canonical ABI, live code hash, snapshot, status, all 11 proposal kinds as Action; block " +
    block,
);
