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
import { proposalSpec, proposalWords, parseTime } from "../src/governance";
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
assert.equal(reasons.length, 14);
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
assert.equal(parseTime("24:00:00"), 86400n);
assert.throws(() => parseTime("24:01"));
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
  from: "09:30",
  to: "16:00",
};
const actions = [];
for (let i = 0; i < 11; i++) {
  const spec = proposalSpec(i, values);
  const d = decodeFunctionData({ abi: vaultAbi, data: encode(spec) });
  assert.equal(d.functionName, "propose");
  assert.equal(d.args?.[0], i);
  assert.equal(String(d.args?.[1]).toLowerCase(), i >= 7 ? zeroAddress : VAULT);
  actions.push({
    action: i,
    dataWords: proposalWords(i, spec.args![2] as `0x${string}`),
  });
}
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
        "All 11 proposal payloads decoded",
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
  "PASS: unit checks, canonical ABI, live code hash, snapshot, status, all 11 proposal payloads; block " +
    block,
);
