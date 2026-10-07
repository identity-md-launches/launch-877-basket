// Run from web/. SOLC must point to solc 0.8.26; only the pinned launch is compiled.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { keccak256, toHex } from 'viem';
const commit = 'b12f8ecdaac0acc13e47646441b4f312a2aab160';
const base = `https://raw.githubusercontent.com/identity-md-launches/launch-929-basket/${commit}`;
const sources: Record<string, { content: string }> = {};
for (const name of ['BaskVault.sol', 'BaskMath.sol']) {
  const response = await fetch(`${base}/src/${name}`);
  if (!response.ok) throw Error(`Cannot fetch pinned ${name}: ${response.status}`);
  sources[`src/${name}`] = { content: await response.text() };
}
const solc = process.env.SOLC || 'solc';
if (!execFileSync(solc, ['--version'], { encoding: 'utf8' }).includes('0.8.26+commit.8a97fa7a')) throw Error('Use solc 0.8.26');
const input = { language: 'Solidity', sources, settings: {
  optimizer: { enabled: true, runs: 200, details: { constantOptimizer: false } },
  viaIR: true, evmVersion: 'cancun', metadata: { bytecodeHash: 'none' },
  outputSelection: { '*': { '*': ['abi', 'evm.deployedBytecode.object'] } },
} };
const output = JSON.parse(execFileSync(solc, ['--standard-json'], { input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
if (output.errors?.some((e: any) => e.severity === 'error')) throw Error(JSON.stringify(output.errors));
const contract = output.contracts['src/BaskVault.sol'].BaskVault;
const runtimeHash = keccak256(`0x${contract.evm.deployedBytecode.object}`);
if (runtimeHash !== '0x62b326b6d8b9191a8777932f5beb87bc1dd07765fdb83bad3c4463924da402d0') throw Error(`Unexpected runtime: ${runtimeHash}`);
const canonical = (o: any): any => Array.isArray(o) ? o.map(canonical) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map(k => [k, canonical(o[k])])) : o;
const abiHash = keccak256(toHex(JSON.stringify(canonical(contract.abi))));
fs.writeFileSync('src/vault.abi.json', JSON.stringify(contract.abi, null, 2) + '\n');
fs.writeFileSync('src/deployment.ts', `// Generated from launch-929-basket at ${commit}; solc 0.8.26, via IR.\nexport const VAULT = "0xd77a5f93f9d85e6990f389147713a9ad8ce5764c" as const;\nexport const RUNTIME_HASH = "${runtimeHash}" as const;\nexport const ABI_HASH = "${abiHash}" as const;\n`);
console.log({ commit, abiHash, runtimeHash, runtimeBytes: contract.evm.deployedBytecode.object.length / 2 });
