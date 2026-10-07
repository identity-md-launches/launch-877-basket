// Test-only fixture builder. It is never imported by the static site.
import fs from "node:fs";
import {
  encodeFunctionResult,
  encodeErrorResult,
  parseAbi,
  type Address,
} from "viem";
import {
  vault,
  token,
  feed,
  encode,
  vaultAbi,
  VAULT,
  client,
  type Spec,
} from "../src/chain";
import { globalNames } from "../src/model";
const addr = (n: number) =>
  ("0x" + n.toString(16).padStart(40, "0")) as Address;
const owner = addr(111),
  guardian = addr(222),
  pending = addr(333),
  user = addr(444),
  now = BigInt(Math.floor(Date.now() / 1000)),
  E = 10n ** 18n;
const assets = [0, 1, 2].map((i) => ({
  token: addr(100 + i),
  feed: addr(200 + i),
  answer: BigInt((i + 1) * 100) * 10n ** 8n,
  updatedAt: now - 3600n,
  minAnswer: 1n,
  maxAnswer: 10n ** 20n,
  open: i === 0,
  retired: i === 2,
  probation: i === 1,
  listedAt: now - 86400n,
  managed: 10n * E,
  short: i === 2,
  balanceReadable: true,
  feedReadable: true,
  totalOwed: i === 2 ? E : 0n,
}));
const globals = {
  owner,
  guardian,
  pendingOwner: pending,
  feeRecipient: addr(0),
  genesisFinalized: true,
  depositsPaused: false,
  depositsOpenAt: now - 86400n,
  NAV_CAP: 1000000n * E,
  totalSupply: 3000n * E,
  proposalCount: 21n,
};
const calls: Record<string, string> = {};
const errors: Record<string, string> = {};
function add(s: Spec, result: any) {
  calls[s.address.toLowerCase() + ":" + encode(s).toLowerCase()] =
    encodeFunctionResult({ ...s, result });
}
for (const name of globalNames) add(vault(name), globals[name]);
add(vault("allAssets"), assets);
add(vault("assetCount"), 3n);
for (const [i, a] of assets.entries()) {
  add(vault("assets", [BigInt(i)]), [
    a.token,
    a.feed,
    a.open,
    a.retired,
    true,
    a.minAnswer,
    a.maxAnswer,
    a.listedAt,
  ]);
  add(vault("managed", [a.token]), a.managed);
  add(vault("totalOwed", [a.token]), a.totalOwed);
  add(token(a.token, "symbol"), ["ALFA", "BRAV", "CHAR"][i]);
  add(
    feed(a.feed, "description"),
    ["ALFA / USD", "BRAV / USD", "CHAR / USD"][i],
  );
  add(feed(a.feed, "latestRoundData"), [1n, a.answer, now, a.updatedAt, 1n]);
  add(token(a.token, "balanceOf", [VAULT]), i === 2 ? 8n * E : 10n * E);
  add(vault("losses", [a.token]), [i === 2 ? 3n * E : 0n, now - 8n * 86400n]);
  for (const wallet of [owner, guardian, pending, user]) {
    add(vault("owed", [wallet, a.token]), i === 2 ? E : 0n);
    add(token(a.token, "balanceOf", [wallet]), 100n * E);
    add(token(a.token, "allowance", [wallet, VAULT]), 100n * E);
  }
  if (a.open) add(vault("depositStatus", [a.token]), [0, addr(0)]);
  for (const n of [1n * E, 10n * E])
    add(vault("previewDeposit", [a.token, n]), {
      nav: 3000n * E,
      value: n * 100n,
      gross: n * 100n,
      fee: n / 2n,
      receiverShares: (n * 995n) / 10n,
      lockedShares: 0n,
      bucketAfter: n * 100n,
    });
  errors[encode(vault("previewDeposit", [a.token, 999n * E]))] =
    encodeErrorResult({
      abi: vaultAbi,
      errorName: "DepositUnavailable",
      args: [19, a.token],
    });
}
for (const wallet of [owner, guardian, pending, user])
  add(vault("balanceOf", [wallet]), 100n * E);
add(vault("previewRedeem", [10n * E]), [
  E / 20n,
  10n * E - E / 20n,
  [E, E * 2n, E * 3n],
]);
const proposals = [
  {
    kind: 0,
    token: assets[0].token,
    target: assets[0].feed,
    value: 0n,
    createdAt: now - 8n * 86400n,
    version: 0n,
    state: 1,
  },
  {
    kind: 5,
    token: addr(0),
    target: addr(999),
    value: 0n,
    createdAt: now - 86400n,
    version: 0n,
    state: 1,
  },
];
add(vault("pendingProposals", [1n, 20n]), [[1n, 2n], proposals]);
add(vault("pendingProposals", [21n, 20n]), [[], []]);
errors[encode(vault("executeProposal", [2n]))] = encodeErrorResult({
  abi: vaultAbi,
  errorName: "ProposalNotReady",
  args: [2n],
});
const actionSelectors = vaultAbi
  .filter(
    (a) =>
      a.type === "function" &&
      a.stateMutability !== "view" &&
      a.stateMutability !== "pure",
  )
  .map((a: any) => a.name);
const fixture = {
  calls,
  errors,
  owner,
  guardian,
  pending,
  user,
  assets,
  VAULT,
  runtime: await client.getCode({ address: VAULT }),
  selector: {
    allAssets: encode(vault("allAssets")).slice(0, 10),
    aggregate3: "0x82ad56cb",
  },
  allowanceKeys: Object.keys(calls).filter((k) => k.includes(":0xdd62ed3e")),
  globals,
};
fs.writeFileSync(
  "../test/scratch/browser-fixture.json",
  JSON.stringify(fixture, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
);
