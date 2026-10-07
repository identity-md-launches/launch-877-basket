import assert from "node:assert/strict";
import fs from "node:fs";
import { keccak256, toHex, decodeFunctionData, type Address } from "viem";
import { ABI_HASH } from "../src/deployment";
import {
  client,
  verifyNetwork,
  vaultAbi,
  read,
  vault,
  simulate,
  explain,
  encode,
  GAS,
  reasons,
  zeroAddress,
  VAULT,
} from "../src/chain";
import {
  fmt,
  navOf,
  amount,
  address,
  parseLaunch,
  depositArgs,
  redeemArgs,
  loadSnapshot,
  cleanFeedDescription,
  pairingMatches,
  depositLimits,
  type Asset,
} from "../src/model";
const canonical = (o: any): any =>
  Array.isArray(o)
    ? o.map(canonical)
    : o && typeof o === "object"
      ? Object.fromEntries(
          Object.keys(o)
            .sort()
            .map((k) => [k, canonical(o[k])]),
        )
      : o;
assert.equal(keccak256(toHex(JSON.stringify(canonical(vaultAbi)))), ABI_HASH);
assert.equal(
  ABI_HASH,
  "0xfb215ccf6f418f03f9bbd7b7a68b806d6fb3f4dd64fe47063dc84eac2f254d89",
);
assert.equal(fmt(-10_000_000n,8,4), "-0.1");
try { amount("1e18"); } catch(e) { assert.match(explain(e,undefined,true), /Enter a decimal amount/); }
assert.equal(client.ccipRead, false);
assert.equal(GAS, 10_000_000n);
assert.equal(reasons.length, 20);
assert.equal(amount("1000000"), 1_000_000n * 10n ** 18n);
assert.equal(amount("0", true), 0n);
for (const invalid of ["-1", "1e18", "0", "1.0000000000000000001"])
  assert.throws(() => amount(invalid));
assert.throws(() => address(zeroAddress));
assert.throws(() => parseLaunch("BASK bad address"));
const w = address(VAULT);
const d = depositArgs(w, 10n, w, 1000n);
assert.equal(d[3], 995n);
assert.ok(
  Number(d[4]) - Date.now() / 1000 > 598 &&
    Number(d[4]) - Date.now() / 1000 <= 600,
);
assert.deepEqual(redeemArgs(1000n, [1000n, 3333n])[1], [999n, 3329n]);
const base = {
  managed: 10n ** 18n,
  answer: 100n * 10n ** 8n,
  feedReadable: true,
  updatedAt: 1000n,
  retired: false,
} as Asset;
assert.equal(navOf([base], true, 1001).nav, 100n * 10n ** 18n);
assert.equal(navOf([{ ...base, retired: true }], true, 1001).nav, 0n);
assert.equal(
  navOf([{ ...base, feedReadable: false }], true, 1001).nav,
  undefined,
);
assert.equal(navOf([base], true, 1000 + 26 * 3600 + 1).stale, true);
assert.equal(navOf([base], true, 1000 + 26 * 3600).stale, false);
assert.equal(
  navOf([{ ...base, managed: 0n, feedReadable: false }], true, 1001).nav,
  0n,
);
assert.equal(navOf([base], false, 1001).nav, undefined);
console.log(
  "PASS: canonical ABI; input/address validation; 18-decimal USD caps; minimums/deadlines; NAV, retirement and stale boundaries.",
);
assert.equal(cleanFeedDescription("Robinhood AAPL / USD", "AAPL"), "AAPL / USD");
assert.equal(cleanFeedDescription("RHSPY / USD", "SPY"), "SPY / USD");
assert.equal(cleanFeedDescription("Robinhood SGOV-USD", "SGOV"), "SGOV-USD");
assert.equal(cleanFeedDescription("RHOTHER / USD", "SPY"), "RHOTHER / USD");
assert.equal(pairingMatches("AAPL", "AAPLX / USD"), false);
assert.equal(pairingMatches("AAPL", "AAPL / USD"), true);
assert.equal(pairingMatches("AAPL", "AAPL"), false);
const E = 10n ** 18n;
for (const nav of [0n, 200_000n * E, 600_000n * E, 1_100_000n * E]) {
  for (const bucket of [0n, 10_000n * E, 100_000n * E, 200_000n * E]) {
    const limits = depositLimits(nav, 1_000_000n * E, bucket, 0n);
    if (limits.fits > 0n) {
      const at = depositLimits(nav, 1_000_000n * E, bucket, limits.fits);
      const above = depositLimits(nav, 1_000_000n * E, bucket, limits.fits + 1n);
      assert.ok(!at.overSize && !at.overDaily);
      assert.ok(above.overSize || above.overDaily);
    }
  }
}
console.log("PASS: feed prefix/pairing boundaries and exact size/daily headroom boundaries.");
const network = await verifyNetwork();
const block = await client.getBlockNumber();
assert.ok(block > 82708976n);
const snapshot = await loadSnapshot();
assert.equal(snapshot.errors.length, 0);
const owner = snapshot.globals.owner as Address;
const guardian = snapshot.globals.guardian as Address;
console.log(
  "PASS: live chain 4663, exact vault runtime, Multicall3:",
  network.multicall,
);
const calls: [string, readonly unknown[], Address][] = [
  ["proposeAssets", [[], []], owner],
  ["proposeAsset", [VAULT, VAULT], owner],
  ["finalizeGenesis", [], owner],
  ["proposeFeed", [VAULT, VAULT], owner],
  ["proposeBand", [VAULT], owner],
  ["proposeReopen", [VAULT], owner],
  ["proposeRetire", [VAULT], owner],
  ["proposeGuardian", [VAULT], owner],
  ["proposeNavCap", [2_000_000n * 10n ** 18n], owner],
  ["executeProposal", [1n], owner],
  ["cancelProposal", [1n], owner],
  ["closeAsset", [VAULT], guardian],
  ["pauseDeposits", [], guardian],
  ["unpauseDeposits", [], owner],
  ["lowerNavCap", [500000n * 10n ** 18n], owner],
  ["setFeeRecipient", [guardian], owner],
  ["transferOwnership", [VAULT], owner],
  ["acceptOwnership", [], owner],
  ["deposit", depositArgs(VAULT, 10n ** 18n, owner, 1000n), owner],
  ["redeem", redeemArgs(0n, []), owner],
  ["claim", [VAULT, owner], owner],
  ["flagDeficit", [VAULT], owner],
  ["recognizeLoss", [VAULT], owner],
];
const results = [];
for (const [name, args, account] of calls) {
  const spec = vault(name, args);
  const decoded = decodeFunctionData({ abi: vaultAbi, data: encode(spec) });
  assert.equal(decoded.functionName, name);
  assert.equal(
    JSON.stringify(decoded.args ?? [], (_, v) =>
      typeof v === "bigint"
        ? v.toString()
        : typeof v === "string"
          ? v.toLowerCase()
          : v,
    ),
    JSON.stringify(args, (_, v) =>
      typeof v === "bigint"
        ? v.toString()
        : typeof v === "string"
          ? v.toLowerCase()
          : v,
    ),
  );
  let result = "success (read-only simulation)";
  try {
    await simulate(spec, account);
  } catch (e) {
    result = explain(e);
    assert.ok(
      !/HTTP|network|fetch|timed out|invalid params/i.test(result),
      result,
    );
  }
  results.push({ function: name, args: args.map((x) => String(x)), result });
  console.log(name + ": " + result);
}
// Deposit preview must surface the deployed custom error, including a zero fault address.
try {
  await read(vault("previewDeposit", [VAULT, 10n ** 18n]));
} catch (e) {
  assert.match(explain(e, undefined, true), /(Genesis|Stock is not listed).*Stock at fault:/);
}
fs.writeFileSync(
  "../artifacts/live-validation.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      network,
      vault: VAULT,
      block,
      globals: snapshot.globals,
      results,
      limitations:
        "Invalid stock/proposal cases intentionally reach deployed custom errors; read-only calls do not predict successful transactions. Successful populated flows are separately checked on a local fork; no live transaction is sent.",
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ) + "\n",
);
console.log(
  "PASS: all 23 vault action encodings and live eth_call simulations; no transaction broadcast.",
);
