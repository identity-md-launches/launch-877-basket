import { useEffect, useRef, useState } from "react";
import { decodeEventLog, type Address, type Hex } from "viem";
import { date, fmt, same, type Snapshot } from "./model";
import {
  chain,
  client,
  encode,
  explain,
  explainAction,
  InputError,
  simulate,
  verifyNetwork,
  type Spec,
  vault,
  read,
  many,
  VAULT,
  vaultAbi,
} from "./chain";
export interface Provider {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
  on?(event: string, fn: (value: any) => void): void;
  removeListener?(event: string, fn: (value: any) => void): void;
}
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export type ActionProgress = { message: string; hash?: Hex; detail?: string };
type PendingTx = { hash: Hex; account: Address; functionName: string };
const pendingKey = "basket-pending-4663";
function savedPending(): PendingTx | undefined {
  try {
    return (
      JSON.parse(sessionStorage.getItem(pendingKey) || "null") || undefined
    );
  } catch {
    return undefined;
  }
}
export function useWallet(refresh: () => Promise<Snapshot>) {
  const sending = useRef(false),
    connectingLock = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [progress, setProgress] = useState<Record<string, ActionProgress>>({});
  const pendingRef = useRef<PendingTx | undefined>(savedPending());
  function report(key: string, value: ActionProgress) {
    setProgress((old) => ({ ...old, [key]: value }));
    setMessage(value.message);
  }
  function fail(key: string, message: string) {
    setProgress((old) => ({ ...old, [key]: { ...old[key], message } }));
  }
  async function listingPending() {
    if (!account) return;
    const pending = pendingRef.current;
    if (pending && same(pending.account, account)) {
      try {
        const receipt = await client.getTransactionReceipt({
          hash: pending.hash,
        });
        if (receipt) {
          pendingRef.current = undefined;
          sessionStorage.removeItem(pendingKey);
        }
      } catch {
        setHash(pending.hash);
        report("listing", {
          message:
            "A transaction is still pending. Wait for its receipt before resuming listing.",
          hash: pending.hash,
        });
        throw new InputError(
          "A transaction is still pending. Wait for its receipt, then resume listing.",
        );
      }
    }
    const [latest, queued] = await Promise.all([
      client.getTransactionCount({ address: account, blockTag: "latest" }),
      client.getTransactionCount({ address: account, blockTag: "pending" }),
    ]);
    if (latest !== queued)
      throw new InputError(
        "A transaction is still pending. Wait until the owner's pending and latest nonce match, then resume listing.",
      );
  }
  async function waitPending() {
    const p = pendingRef.current;
    if (p && same(p.account, account)) {
      report("listing", {
        message: "Submitted. Waiting for the pending transaction…",
        hash: p.hash,
      });
      await client.waitForTransactionReceipt({
        hash: p.hash,
        timeout: 180_000,
        pollingInterval: 3000,
      });
    }
    await listingPending();
    await refresh();
  }
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    hash: Hex;
    functionName: string;
  }>();
  useEffect(() => {
    const p = window.ethereum;
    if (!p) return;
    const accounts = (a: Address[]) => setAccount(a[0]);
    const network = (n: string) => setChainId(Number(n));
    p.request({ method: "eth_accounts" })
      .then(accounts)
      .catch(() => {});
    p.request({ method: "eth_chainId" })
      .then(network)
      .catch(() => {});
    p.on?.("accountsChanged", accounts);
    p.on?.("chainChanged", network);
    return () => {
      p.removeListener?.("accountsChanged", accounts);
      p.removeListener?.("chainChanged", network);
    };
  }, []);
  async function connect() {
    if (connectingLock.current) return;
    connectingLock.current = true;
    setConnecting(true);
    try {
      if (!window.ethereum)
        throw new Error("Open this page in your wallet app's browser");
      const a = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAccount(a[0]);
      setChainId(
        Number(await window.ethereum.request({ method: "eth_chainId" })),
      );
      setMessage("");
    } catch (e) {
      setMessage(explain(e));
    } finally {
      connectingLock.current = false;
      setConnecting(false);
    }
  }
  async function switchChain() {
    try {
      const p = window.ethereum;
      if (!p) return;
      try {
        await p.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x1237" }],
        });
      } catch (e) {
        if ((e as { code: number }).code !== 4902) throw e;
        await p.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x1237",
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls.default.http,
              blockExplorerUrls: [chain.blockExplorers.default.url],
            },
          ],
        });
      }
      setChainId(Number(await p.request({ method: "eth_chainId" })));
    } catch (e) {
      setMessage(explain(e));
    }
  }
  async function send(s: Spec, key = s.functionName, label = key) {
    if (sending.current)
      throw new InputError("A transaction is already in progress.");
    sending.current = true;
    setBusy(true);
    setHash(undefined);
    report(key, { message: `${label}: Checking…` });
    let sent: Hex | undefined;
    let settled = false;
    try {
      const p = window.ethereum;
      if (!p || !account)
        throw new Error("Connect a wallet to send this transaction.");
      const [id, accounts] = await Promise.all([
        p.request({ method: "eth_chainId" }),
        p.request({ method: "eth_accounts" }),
      ]);
      if (Number(id) !== 4663)
        throw new Error(
          "Switch your wallet to Robinhood Chain (4663) before sending.",
        );
      if (accounts[0]?.toLowerCase() !== account.toLowerCase())
        throw new Error("The wallet account changed. Please retry.");
      if (s.functionName === "genesisList") await listingPending();
      await verifyNetwork();
      await simulate(s, account);
      const gas = ["redeem", "claim"].includes(s.functionName)
        ? ((await client.estimateGas({
            account,
            to: s.address,
            data: encode(s),
          })) *
            130n +
            99n) /
          100n
        : undefined;
      // Recheck immediately before requesting a signature; never switch chains implicitly.
      if (Number(await p.request({ method: "eth_chainId" })) !== 4663)
        throw new Error("The wallet chain changed. Please retry.");
      const freshAccounts = await p.request({ method: "eth_accounts" });
      if (freshAccounts[0]?.toLowerCase() !== account.toLowerCase())
        throw new Error("The wallet account changed. Please retry.");
      report(key, { message: `${label}: Waiting for wallet…` });
      const tx = (await p.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: s.address,
            data: encode(s),
            ...(gas ? { gas: `0x${gas.toString(16)}` } : {}),
          },
        ],
      })) as Hex;
      sent = tx;
      setHash(tx);
      pendingRef.current = { hash: tx, account, functionName: s.functionName };
      try {
        sessionStorage.setItem(pendingKey, JSON.stringify(pendingRef.current));
      } catch {
        /* nonce guard also protects reloads */
      }
      report(key, {
        message: `${label}: Submitted. Waiting for confirmation…`,
        hash: tx,
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: tx,
        timeout: 180_000,
        pollingInterval: 3000,
      });
      settled = true;
      pendingRef.current = undefined;
      try {
        sessionStorage.removeItem(pendingKey);
      } catch {
        /* storage unavailable */
      }
      if (receipt.status !== "success")
        throw new Error(
          "The transaction reverted. Refresh the data before retrying.",
        );
      setConfirmed({ hash: tx, functionName: s.functionName });
      report(key, { message: `${label}: Confirmed. Refreshing…`, hash: tx });
      let detail = "";
      try {
        const fresh = await refresh();
        if (s.functionName === "propose") {
          const event = receipt.logs
            .filter((l) => same(l.address, VAULT))
            .map((l) => {
              try {
                return decodeEventLog({
                  abi: vaultAbi,
                  data: l.data,
                  topics: l.topics,
                });
              } catch {
                return undefined;
              }
            })
            .find((l) => l?.eventName === "Proposed");
          if (!event) throw new Error("Proposal event unreadable");
          const id = (event.args as any).id;
          const proposal = await read(vault("proposal", [id]));
          detail = `Proposal ${id}; ready ${date(proposal.readyAt)} (read from chain).`;
        }
        if (["redeem", "claim"].includes(s.functionName)) {
          const creditor =
            s.functionName === "redeem" ? (s.args![1] as Address) : account;
          const values = await many(
            fresh.assets.map((a) => vault("owed", [creditor, a.token])),
          );
          const remaining = fresh.assets.flatMap((a, i) => {
            const value = values[i];
            return !value.ok
              ? [`${a.symbol}: unreadable — Retry claims`]
              : value.value > 0n
                ? [`${a.symbol}: ${fmt(value.value, a.tokenDecimals)}`]
                : [];
          });
          const zeros = values.filter((v) => v.ok && v.value === 0n).length;
          detail =
            `Still owed to ${creditor}: ` +
            (fresh.complete
              ? (remaining.join("; ") || "Nothing owed.") +
                (zeros ? ` Nothing owed for ${zeros} other stocks.` : "")
              : "Stock list unreadable — Retry vault.");
        }
      } catch {
        detail =
          "Refresh unreadable. Retry vault / claims to read the confirmed result.";
      }
      report(key, { message: `${label}: Confirmed.`, hash: tx, detail });
      return receipt;
    } catch (e) {
      const message = await explainAction(e, s);
      const status =
        sent && !settled
          ? "Receipt timed out or unreadable. This transaction may still be pending. Wait for its receipt before retrying."
          : message;
      report(key, { message: status, hash: sent });
      throw new InputError(status);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return {
    account,
    connecting,
    progress,
    report,
    fail,
    listingPending,
    waitPending,
    chainId,
    message,
    hash,
    busy,
    confirmed,
    connect,
    switchChain,
    send,
    setMessage,
  };
}
export type Wallet = ReturnType<typeof useWallet>;
