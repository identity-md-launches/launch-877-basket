import { useEffect, useState } from "react";
import type { Address, Hex } from "viem";
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
export function useWallet(refresh: () => void) {
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ hash: Hex; functionName: string }>();
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
    try {
      if (!window.ethereum)
        throw new Error(
          "No browser wallet found. Open this site in an Ethereum-compatible wallet browser or install a wallet extension.",
        );
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
  async function send(s: Spec) {
    if (busy) return;
    setBusy(true);
    setHash(undefined);
    setMessage("Checking transaction…");
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
      await verifyNetwork();
      await simulate(s, account);
      // Recheck immediately before requesting a signature; never switch chains implicitly.
      if (Number(await p.request({ method: "eth_chainId" })) !== 4663)
        throw new Error("The wallet chain changed. Please retry.");
      setMessage("Confirm the transaction in your wallet.");
      const tx = (await p.request({
        method: "eth_sendTransaction",
        params: [{ from: account, to: s.address, data: encode(s) }],
      })) as Hex;
      setHash(tx);
      setMessage("Transaction submitted. Waiting for confirmation…");
      const receipt = await client.waitForTransactionReceipt({
        hash: tx,
        timeout: 180_000,
        pollingInterval: 3000,
      });
      if (receipt.status !== "success")
        throw new Error(
          "The transaction reverted. Refresh the data before retrying.",
        );
      setConfirmed({ hash: tx, functionName: s.functionName });
      setMessage(s.functionName === "deposit" ? "Deposit confirmed" : "Transaction confirmed. Vault data refreshed.");
      refresh();
    } catch (e) {
      const message = await explainAction(e, s);
      setMessage(message);
      throw new InputError(message);
    } finally {
      setBusy(false);
    }
  }
  return {
    account,
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
