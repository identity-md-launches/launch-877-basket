// Compile the immutable pinned source, never the historical root contracts.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { keccak256, toHex } from "viem";
const commit = "50acd7248c2ce59907a963a648115900d629f352";
const names = [
  "BaskVault.sol",
  "libraries/BoundedCall.sol",
  "libraries/FullMath.sol",
  "libraries/NewYorkTime.sol",
  "libraries/PoolOracle.sol",
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
const runtime = c.evm.deployedBytecode.object;
// Vault 6 has no immutables: its runtime is byte-for-byte the compiler output.
if (Object.keys(c.evm.deployedBytecode.immutableReferences ?? {}).length !== 0)
  throw Error("Unexpected immutable references");
const runtimeHash = keccak256(`0x${runtime}`);
if (
  runtimeHash !==
  "0x636a9477cd2d80694d0c8cc970f5008edb87d71a11b10ccfa82d9db04090a048"
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
  `// Generated from launch-1110-basket at ${commit}\nexport const VAULT = "0x739fd5b653aa092a434534fa1ade67c1770b5a5b" as const;\nexport const RUNTIME_HASH = "${runtimeHash}" as const;\nexport const ABI_HASH = "${abiHash}" as const;\n`,
);
console.log({
  commit,
  abiHash,
  runtimeHash,
  runtimeBytes: runtime.length / 2,
});
