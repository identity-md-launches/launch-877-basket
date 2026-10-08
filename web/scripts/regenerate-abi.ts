// Compile the immutable pinned source, never the historical root contracts.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { keccak256, toHex } from "viem";
const commit = "0a88bde525aed4557b375cf60ee503d707570ac0";
const names = [
  "BaskVault.sol",
  "BaskTypes.sol",
  "libraries/BaskOracle.sol",
  "libraries/FullMath.sol",
  "libraries/TickMath.sol",
];
const sources = Object.fromEntries(
  names.map((n) => [
    "src/" + n,
    { content: fs.readFileSync("pinned/src/" + n, "utf8") },
  ]),
);
const solc = process.env.SOLC || "solc";
if (
  !execFileSync(solc, ["--version"], { encoding: "utf8" }).includes(
    "0.8.26+commit.8a97fa7a",
  )
)
  throw Error("Use solc 0.8.26");
const settings = {
  optimizer: { enabled: true, runs: 200 },
  viaIR: true,
  evmVersion: "cancun",
  metadata: { bytecodeHash: "none" },
  outputSelection: {
    "*": {
      "*": [
        "abi",
        "evm.deployedBytecode.object",
        "evm.deployedBytecode.immutableReferences",
      ],
    },
  },
};
const output = JSON.parse(
  execFileSync(solc, ["--standard-json"], {
    input: JSON.stringify({ language: "Solidity", sources, settings }),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }),
);
if (output.errors?.some((e: any) => e.severity === "error"))
  throw Error(JSON.stringify(output.errors));
const c = output.contracts["src/BaskVault.sol"].BaskVault;
let runtime = c.evm.deployedBytecode.object;
const transferTopic = keccak256(
  toHex("Transfer(address,address,uint256)"),
).slice(2);
for (const refs of Object.values(
  c.evm.deployedBytecode.immutableReferences,
) as any[])
  for (const r of refs) {
    if (r.length !== 32) throw Error("Unexpected immutable");
    runtime =
      runtime.slice(0, r.start * 2) +
      transferTopic +
      runtime.slice((r.start + r.length) * 2);
  }
const runtimeHash = keccak256(`0x${runtime}`);
if (
  runtimeHash !==
  "0x0419f8e9496a55eaafb9b3fa203d459cc7f82fdac17359c11f51c2e59a5f64fe"
)
  throw Error("Runtime mismatch " + runtimeHash);
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
const abiHash = keccak256(toHex(JSON.stringify(canonical(c.abi))));
fs.writeFileSync("src/vault.abi.json", JSON.stringify(c.abi, null, 2) + "\n");
fs.writeFileSync(
  "src/deployment.ts",
  `// Generated from launch-1020-basket at ${commit}; transferTopic immutable filled.\nexport const VAULT = "0x4e19d7472e650399b06eeaa5ccc29da9b8efbebd" as const;\nexport const RUNTIME_HASH = "${runtimeHash}" as const;\nexport const ABI_HASH = "${abiHash}" as const;\n`,
);
console.log({
  commit,
  abiHash,
  runtimeHash,
  runtimeBytes: runtime.length / 2,
  transferTopic: "0x" + transferTopic,
});
