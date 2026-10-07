import {
  createPublicClient,
  http,
  fallback,
  defineChain,
  encodeFunctionData,
  decodeFunctionResult,
  decodeErrorResult,
  keccak256,
  parseAbi,
  multicall3Abi,
  zeroAddress,
  type Address,
  type Abi,
  type Hex,
} from "viem";
import { mainnet } from "viem/chains";
import vaultJson from "./vault.abi.json";
import { VAULT, RUNTIME_HASH } from "./deployment";
export { VAULT, zeroAddress };
export const GAS = 10_000_000n;
export const chain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        "https://rpc.mainnet.chain.robinhood.com",
        "https://robinhood-rpc.publicnode.com",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Explorer", url: "https://robin.etherscan.io" },
  },
});
export const client = createPublicClient({
  chain,
  ccipRead: false,
  batch: { multicall: false },
  transport: fallback(
    chain.rpcUrls.default.http.map((url) =>
      http(url, { timeout: 15_000, retryCount: 0 }),
    ),
    { retryCount: 0 },
  ),
});
export const vaultAbi = vaultJson as Abi;
export const tokenAbi = parseAbi([
  "function symbol() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
]);
export const feedAbi = parseAbi([
  "function description() view returns (string)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);
export class InputError extends Error {}
export type ReadResult<T = any> =
  | { ok: true; value: T }
  | { ok: false; error: string };
export type Spec = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};
export const vault = (
  functionName: string,
  args: readonly unknown[] = [],
): Spec => ({ address: VAULT, abi: vaultAbi, functionName, args });
export const token = (
  address: Address,
  functionName: string,
  args: readonly unknown[] = [],
): Spec => ({ address, abi: tokenAbi, functionName, args });
export const feed = (address: Address, functionName: string): Spec => ({
  address,
  abi: feedAbi,
  functionName,
});
export const encode = (s: Spec) => encodeFunctionData(s);
export async function read(s: Spec, account?: Address): Promise<any> {
  const result = await client.call({
    to: s.address,
    data: encode(s),
    gas: GAS,
    account,
    batch: false,
  });
  return decodeFunctionResult({ ...s, data: result.data ?? "0x" });
}
export async function safe(s: Spec): Promise<ReadResult> {
  try {
    return { ok: true, value: await read(s) };
  } catch {
    return { ok: false, error: `${s.functionName}: unreadable` };
  }
}
// Multicall3 is network infrastructure, never a source of asset/role addresses.
// Use the SDK's canonical deployment only after checking code on this chain.
let multicall: Address | undefined;
export async function verifyNetwork() {
  const [id, code, mc] = await Promise.all([
    client.getChainId(),
    client.getCode({ address: VAULT }),
    client
      .getCode({ address: mainnet.contracts.multicall3.address })
      .catch(() => undefined),
  ]);
  multicall =
    mc && mc !== "0x" ? mainnet.contracts.multicall3.address : undefined;
  if (id !== chain.id)
    throw new Error("RPC chain is not 4663. Transactions are unavailable.");
  if (!code || keccak256(code) !== RUNTIME_HASH)
    throw new Error(
      "Vault code could not be verified. Transactions are unavailable.",
    );
  return { multicall: !!multicall };
}
export async function many(specs: Spec[]): Promise<ReadResult[]> {
  if (!specs.length) return [];
  // Feed-heavy aggregate views MUST remain independent 10M-gas calls.
  if (
    specs.some((s) =>
      ["allAssets", "depositStatus", "previewDeposit"].includes(s.functionName),
    )
  )
    throw new Error("Heavy view cannot be batched");
  if (!multicall) return Promise.all(specs.map(safe));
  const results: ReadResult[] = [];
  for (let start = 0; start < specs.length; start += 20) {
    const chunk = specs.slice(start, start + 20);
    try {
      const output = await read({
        address: multicall,
        abi: multicall3Abi,
        functionName: "aggregate3",
        args: [
          chunk.map((s) => ({
            target: s.address,
            allowFailure: true,
            callData: encode(s),
          })),
        ],
      });
      results.push(
        ...(await Promise.all(
          chunk.map(async (s, i) => {
            try {
              if (!output[i].success) return await safe(s);
              return {
                ok: true as const,
                value: decodeFunctionResult({
                  ...s,
                  data: output[i].returnData,
                }),
              };
            } catch {
              return safe(s);
            }
          }),
        )),
      );
    } catch {
      results.push(...(await Promise.all(chunk.map(safe))));
    }
  }
  return results;
}
// Ordinals and custom errors from the pinned launch-929 BaskVault source.
export const reasons = [
  "Ready for deposits",
  "Genesis has not been finalized",
  "The 72-hour opening delay has not ended",
  "Deposits are paused",
  "Stock is not listed",
  "Stock is retired",
  "Stock is closed",
  "Stock balance is unreadable",
  "Stock balance does not cover outstanding claims",
  "The deposit market window is closed",
  "Fewer than three stock prices are fresh within four hours",
  "Stock price feed is unreadable",
  "Stock price is zero or negative",
  "Stock price is outside its allowed band",
  "Stock price is dated in the future",
  "Stock price is more than 26 hours old",
  "Oracle pause status is unreadable",
  "Stock oracle is paused",
  "Stock has an accounting shortfall",
  "The vault has supply but zero NAV",
];
export const proposalKinds = ["List", "Feed", "Band", "Reopen", "Retire", "Guardian", "NavCap"] as const;
export const proposalStates = ["Missing", "Waiting", "Ready", "Expired", "Cancelled", "Executed", "Voided"] as const;
export function proposalStateWords(state: number, createdAt: bigint) {
  if (state === 1) return "waiting, executable from " + new Date(Number(createdAt + 7n * 86400n) * 1000).toLocaleString("en-GB", { timeZone: "UTC" }) + " UTC";
  return proposalStates[state]?.toLowerCase() ?? "state unreadable; refresh proposals";
}
export const errorWords: Record<string, string> = {
  Unauthorized: "This wallet is not allowed to perform this action.",
  Reentrancy: "The contract rejected a reentrant call.",
  InvalidAddress: "Choose a valid allowed address.",
  InvalidAsset: "The Stock Token is not valid for this action. Check its listing and retirement status.",
  InvalidFeed: "Check the feed format, price and pairing. A feed may serve only one unretired stock.",
  AssetLimit: "The vault has reached its 64-stock limit.",
  LengthMismatch: "Token and feed lists must have the same length.",
  InvalidState: "This action is unavailable in the current vault state. Refresh and check its requirements.",
  InvalidProposal: "Check the proposal’s current state and refresh proposals.",
  ChangeTooSoon: "The 24-hour stock/feed change cooldown has not ended.",
  DeadlineExpired: "The deadline has passed. Refresh the preview and retry.",
  Slippage: "The preview changed beyond your minimum. Refresh and retry.",
  InvalidAmount: "Choose an amount within the allowed range and large enough to receive shares.",
  CapExceeded: "This deposit exceeds the vault size limit. Reduce the amount.",
  BucketExceeded: "This deposit exceeds today’s limit. Reduce the amount or wait; the daily limit refills over 24 hours.",
  TransferFailed: "The stock transfer failed. If the issuer paused it, retry later or use another claim recipient.",
  InsufficientBalance: "Your balance is too low for this amount.",
  InsufficientAllowance: "Approve the deposit amount first.",
  BalanceUnreadable: "The stock balance is unreadable. Retry later.",
  MathOverflow: "This amount is outside the supported range.",
};
export async function explainAction(e: unknown, spec: Spec): Promise<string> {
  if (spec.functionName === "executeProposal") {
    try {
      const id = spec.args![0];
      const [state, proposal] = await Promise.all([read(vault("proposalState", [id])), read(vault("proposals", [id]))]);
      if (Number(state) !== 2) return "Proposal is " + proposalStateWords(Number(state), proposal[4]) + ".";
    } catch { return "Proposal state is unreadable. Refresh proposals before retrying."; }
  }
  return explain(e);
}
function revertData(e: any): Hex | undefined {
  if (!e || typeof e !== "object") return undefined;
  if (typeof e.data === "string" && /^0x[0-9a-fA-F]{8,}$/.test(e.data))
    return e.data;
  return revertData(e.cause) ?? revertData(e.error) ?? revertData(e.data);
}
export function explain(
  e: unknown,
  symbol: (a: Address) => string = (a) => a,
  readFailure = false,
): string {
  if (e instanceof InputError) return e.message;
  const data = revertData(e);
  if (data)
    try {
      const parsed = decodeErrorResult({ abi: vaultAbi, data });
      if (parsed.errorName === "DepositUnavailable") {
        const [reason, asset] = parsed.args as [number, Address];
        return `${reasons[reason] ?? `Unknown reason ${reason}`}. Stock at fault: ${asset === zeroAddress ? "none" : symbol(asset)}.`;
      }
      return errorWords[parsed.errorName] ?? parsed.errorName;
    } catch {
      /* Keep the rest of the page usable even for unknown revert data. */
    }
  if (readFailure) return "Preview: unreadable. Retry the preview.";
  const err = e as { shortMessage?: string; message?: string; code?: number };
  if (/timed out while waiting for transaction|receipt.*not found/i.test(err.shortMessage ?? err.message ?? ""))
    return "Confirmation could not be read. Check the transaction link and refresh the vault before retrying.";
  if (err.code === 4001 || /rejected|denied/i.test(err.message ?? ""))
    return "The wallet request was declined. You can try again.";
  return err.shortMessage ?? err.message ?? "The request failed. Please retry.";
}
export async function simulate(s: Spec, account?: Address): Promise<void> {
  await client.call({
    to: s.address,
    data: encode(s),
    account,
    gas: GAS,
    batch: false,
  });
}
