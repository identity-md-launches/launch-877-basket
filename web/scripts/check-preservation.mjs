// Vault 6 invariants replace the obsolete expression-equality check.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const root = process.env.BASKET_SOURCE_ROOT || path.resolve("..");
const get = (p) => fs.readFileSync(path.join(root, p), "utf8");
const protectedFiles = [
  "foundry.toml",
  "remappings.txt",
  "web/package.json",
  "web/package-lock.json",
  "src/BaskVault.sol",
  "src/BaskMath.sol",
];
for (const p of protectedFiles)
  assert.equal(
    get(p),
    execFileSync("git", ["show", "HEAD:" + p], { cwd: root, encoding: "utf8" }),
    p + " changed",
  );
const chain = get("web/src/chain.ts"),
  wallet = get("web/src/wallet.tsx"),
  model = get("web/src/model.ts"),
  main = get("web/src/main.tsx");
assert.match(chain, /GAS = 30_000_000n/);
assert.match(chain, /keccak256\(code\) !== RUNTIME_HASH/);
for (const x of [
  "await verifyNetwork()",
  "await simulate(s, account)",
  "eth_accounts",
  "eth_chainId",
  "estimateGas",
  "130n",
  "eth_sendTransaction",
])
  assert.ok(wallet.includes(x), x);
assert.match(model, /tokenDecimals\s*\+\s*a.feedDecimals/);
assert.match(model, /995n/);
assert.match(model, /999n/);
for (const x of [
  "Not for US persons. Stock Tokens are not offered in the United States",
  "Basket Protocol is not",
  "affiliated with the issuer of Stock Tokens.",
  "Owner controls",
  "Losses",
])
  assert.ok(main.includes(x), x);
// Fragments of the five abandoned vault addresses are forbidden in every file.
const oldVaults = [
  "a00d" + "a50c",
  "518a" + "a023",
  "d77a" + "5f93",
  "b587" + "8b75",
  "4e19" + "d747",
];
const forbidden = [
  ...oldVaults,
  "decayed" + "Bucket",
  "deposits" + "OpenAt",
  "assetIndex" + "PlusOne",
  "setFee" + "Recipient",
  "proposal" + "State",
];
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", ".imd", "node_modules", "lib", "scratch"].includes(entry.name))
      continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else files.push(p);
  }
}
walk(root);
for (const p of files) {
  if (p.includes("/src/") && !p.includes("/web/")) continue;
  const b = fs.readFileSync(p);
  if (b.includes(0)) continue;
  const s = b.toString();
  const scope = path.relative(root, p);
  const words =
    /^(web|dist|artifacts)\//.test(scope) ||
    ["README.md", "DESIGN.md"].includes(scope)
      ? forbidden
      : oldVaults;
  for (const word of words)
    assert.ok(
      !s.toLowerCase().includes(word.toLowerCase()),
      path.relative(root, p) + " contains abandoned integration",
    );
}
const bytes = files
  .filter((p) => !p.includes("/test/scratch/"))
  .reduce((n, p) => n + fs.statSync(p).size, 0);
assert.ok(bytes < 8388608, `Submission bytes ${bytes}`);
console.log(
  `PASS: protected source/configuration, send checks, current ABI invariants, wording, obsolete integration scan; ${bytes} bytes excluding vendored contract library and Git metadata. Final bundle accounting also includes tracked lib files.`,
);
