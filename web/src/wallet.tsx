import { useEffect, useRef, useState } from "react";
import { checkItemSend, itemError } from "./itemActions"; // SPEC 6: isolated ITEM checks and errors.
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
  many,
  VAULT,
  vaultAbi,
} from "./chain";
export interface Provider {
  request(args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }): Promise<any>;
  on?(event: string, fn: (value: any) => void): void;
  removeListener?(event: string, fn: (value: any) => void): void;
}
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export type ActionProgress = { message: string; hash?: Hex; detail?: string };
// A send whose nonce was used by a cancel or a different transaction in the
// wallet: the receipt belongs to that other transaction, so nothing of this
// action happened.
export class TransactionCancelled extends InputError {}
// Shown when a saved listing transaction that was reported pending is mined or
// replaced.
export const LISTING_FINISHED =
  "The earlier transaction is finished (confirmed or replaced). Press Resume listing.";
// 2026-10-17, pre-launch review: the ITEM pages' reason while an earlier send has no receipt yet (their existing words).
export const ITEM_PENDING = "Another transaction is pending. Finish it in your wallet or wait for its receipt.";
// v22 (2026-10-17, live-site review): every send except genesis listing first
// settles the saved transaction of this tab. While it has no receipt and its
// nonce has not passed, the press is refused with its hash and these words.
export const PENDING_WAIT =
  "Receipt timed out or unreadable. This transaction may still be pending. Wait for its receipt before retrying.";
// Once it is found mined or replaced, the record goes, the vault is read again
// and that press is refused once, so the result is seen before any retry.
export const PENDING_FINISHED =
  "The earlier transaction is finished (confirmed or replaced). Refresh the vault before retrying.";
class PendingTransaction extends Error {
  constructor(
    message: string,
    public hash?: Hex,
  ) {
    super(message);
  }
}
type PendingTx = {
  hash: Hex;
  account: Address;
  functionName: string;
  nonce?: number;
};
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
// 2026-10-17, round-3 review: ITEM sends keep a saved record of their own, apart from the vault's, so a vault send in
// this tab never overwrites or clears it.
const itemPendingKey = "basket-item-pending-4663";
function savedItemPending(): PendingTx | undefined {
  try {
    return (
      JSON.parse(sessionStorage.getItem(itemPendingKey) || "null") || undefined
    );
  } catch {
    return undefined;
  }
}
// Set by Disconnect and kept across reloads until Connect wallet is answered.
const disconnectedKey = "basket-disconnected-4663";
function savedDisconnected() {
  try {
    return localStorage.getItem(disconnectedKey) === "1";
  } catch {
    return false;
  }
}
// The BASK logo a wallet is asked to show (EIP-747 image): the 256 px PNG
// on IPFS.
const BASK_IMAGE =
  "https://gateway.pinata.cloud/ipfs/bafkreiczp2hrpey42mx5hngo37rrwwwexrt3mdm537pyztv22pn4skxsvi";
export function useWallet(refresh: () => Promise<Snapshot>) {
  const sending = useRef(false),
    connectingLock = useRef(false);
  // Mirrors the saved flag, so Disconnect also holds without storage.
  const disconnected = useRef(savedDisconnected());
  const accountVersion = useRef(0);
  // Advanced by Connect wallet and Disconnect only: a Connect answer that
  // arrives after a later Disconnect is dropped.
  const connectVersion = useRef(0);
  const [connecting, setConnecting] = useState(false);
  const [progress, setProgress] = useState<Record<string, ActionProgress>>({});
  const pendingRef = useRef<PendingTx | undefined>(savedPending());
  // True while a "still pending" listing message (or a receipt timeout, or a
  // transaction saved before a reload) may be on screen.
  const pendingShown = useRef(!!pendingRef.current);
  // 2026-10-17, round-3 review: the ITEM sends' own saved record, apart from the vault's slot above.
  const itemRef = useRef<PendingTx | undefined>(savedItemPending());
  function report(key: string, value: ActionProgress) {
    setProgress((old) => ({ ...old, [key]: value }));
    setMessage(value.message);
  }
  // Replace a status everywhere (action status and the top bar), link included.
  function notice(key: string, message: string) {
    setProgress((old) => ({ ...old, [key]: { message } }));
    setMessage(message);
    setHash(undefined);
  }
  // A saved transaction was found mined or replaced: clear the stale pending
  // text and its link and say so. Returns true.
  function finished() {
    if (pendingShown.current) notice("listing", LISTING_FINISHED);
    pendingShown.current = false;
    return true;
  }
  function fail(key: string, message: string) {
    setProgress((old) => ({ ...old, [key]: { ...old[key], message } }));
  }
  // Resolves true when a saved transaction was found mined or replaced.
  async function listingPending(waitForReceipt = false): Promise<boolean> {
    if (!account) return false;
    const pending = pendingRef.current;
    let done = false;
    if (pending && same(pending.account, account)) {
      try {
        const receipt = await client.getTransactionReceipt({
          hash: pending.hash,
        });
        if (receipt) {
          pendingRef.current = undefined;
          sessionStorage.removeItem(pendingKey);
          done = finished();
        }
      } catch {
        // A mined Speed up/Cancel consumes the original transaction's nonce.
        // The node's own record of the transaction beats the pending count
        // saved before the wallet prompt (another send may have slipped in).
        const [transaction, latest] = await Promise.all([
          client.getTransaction({ hash: pending.hash }).catch(() => undefined),
          client.getTransactionCount({ address: account, blockTag: "latest" }),
        ]);
        const nonce = transaction?.nonce ?? pending.nonce;
        if (nonce !== undefined && latest > nonce) {
          pendingRef.current = undefined;
          sessionStorage.removeItem(pendingKey);
          setHash(undefined);
          done = finished();
        } else if (!waitForReceipt) {
          setHash(pending.hash);
          pendingShown.current = true;
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
    }
    const [latest, queued] = await Promise.all([
      client.getTransactionCount({ address: account, blockTag: "latest" }),
      client.getTransactionCount({ address: account, blockTag: "pending" }),
    ]);
    if (!waitForReceipt && latest !== queued)
      throw new InputError(
        "A transaction is still pending. Wait until the owner's pending and latest nonce match, then resume listing.",
      );
    return done;
  }
  async function waitPending() {
    // Reconcile a replacement before waiting on a hash that cannot get a receipt.
    await listingPending(true);
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
  // v22: settles the saved transaction of this tab before a send, whichever
  // account sent it (listGenesis keeps listingPending and its Resume buttons).
  // Mined or replaced: a receipt, the nonce the node reports for the hash
  // passed, or the count saved before the prompt passed while nothing is
  // queued (listingPending's second guard). Fail closed: only the node's "not
  // found" answer to a hash lookup (viem's TransactionReceiptNotFoundError or
  // TransactionNotFoundError) counts as absent; any other error of the two
  // lookups refuses the press with the pending words and the hash, and an
  // error of either count read propagates to send()'s catch; the record stays.
  async function sendPending(key: string) {
    const pending = pendingRef.current;
    if (!pending) return;
    const absent = (name: string) => (e: unknown) => {
      if ((e as { name?: string } | null)?.name === name) return undefined;
      throw new PendingTransaction(PENDING_WAIT, pending.hash);
    };
    let finished = !!(await client
      .getTransactionReceipt({ hash: pending.hash })
      .catch(absent("TransactionReceiptNotFoundError")));
    if (!finished) {
      const [transaction, latest, queued] = await Promise.all([
        client
          .getTransaction({ hash: pending.hash })
          .catch(absent("TransactionNotFoundError")),
        client.getTransactionCount({
          address: pending.account,
          blockTag: "latest",
        }),
        client.getTransactionCount({
          address: pending.account,
          blockTag: "pending",
        }),
      ]);
      finished =
        transaction !== undefined
          ? latest > transaction.nonce
          : pending.nonce !== undefined &&
            latest > pending.nonce &&
            latest === queued;
    }
    if (!finished) throw new PendingTransaction(PENDING_WAIT, pending.hash);
    pendingRef.current = undefined;
    try {
      sessionStorage.removeItem(pendingKey);
    } catch {
      /* storage unavailable */
    }
    void refresh().catch(() => {});
    throw new PendingTransaction(PENDING_FINISHED, pending.hash);
  }
  // 2026-10-17, pre-launch review: ITEM actions stay off while a sent transaction has no receipt yet. Settles the
  // saved one when it is mined, replaced or its nonce has passed; returns the hash still unresolved, if any.
  async function itemPending(): Promise<Hex | undefined> {
    const pending = itemRef.current;
    if (!account || !pending) {
      setUnresolved(undefined);
      return undefined;
    }
    // 2026-10-17, v22 rebase (Codex V22-02, the rule of sendPending above): only viem's "not found" answer to a hash lookup
    // counts as absent; any other error of the two lookups leaves this check unresolved (no settle by either nonce rule; the
    // record and the lock stay) and never rejects, so Refresh and opening Earn keep working.
    let failed = false;
    const absent = (name: string) => (e: unknown) => {
      if ((e as { name?: string } | null)?.name === name) return undefined;
      failed = true;
      return undefined;
    };
    let settled = !!(await client
      .getTransactionReceipt({ hash: pending.hash })
      .catch(absent("TransactionReceiptNotFoundError")));
    if (!settled && !failed) {
      // 2026-10-17, round-2 review: the record's own account is read, so another account in this tab waits too; a nonce
      // the node reports settles alone; the predicted one only while nothing is queued, as listingPending's second guard.
      const [transaction, latest, queued] = await Promise.all([
        client.getTransaction({ hash: pending.hash }).catch(absent("TransactionNotFoundError")),
        client.getTransactionCount({ address: pending.account, blockTag: "latest" }).catch(() => undefined),
        client.getTransactionCount({ address: pending.account, blockTag: "pending" }).catch(() => undefined),
      ]);
      settled = !failed && latest !== undefined && (transaction !== undefined ? latest > transaction.nonce : pending.nonce !== undefined && latest > pending.nonce && latest === queued);
    }
    // 2026-10-17, round-3 review: a late answer settles only the record it examined; a newer send's record stays.
    const current = itemRef.current;
    if (settled && (current === pending || current === undefined)) {
      itemRef.current = undefined;
      try {
        sessionStorage.removeItem(itemPendingKey);
      } catch {
        /* storage unavailable */
      }
      setUnresolved(undefined);
      return undefined;
    }
    const hash = current?.hash; // 2026-10-17, round-4 review: a record cleared meanwhile (by its receipt or a check that settled it) leaves nothing to wait for.
    setUnresolved(hash);
    return hash;
  }
  const [account, setAccount] = useState<Address>();
  const [chainId, setChainId] = useState<number>();
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hex>();
  const [busy, setBusy] = useState(false);
  // 2026-10-17, pre-launch review: the hash of a sent transaction without a receipt yet; ITEM actions wait for it.
  const [unresolved, setUnresolved] = useState<Hex | undefined>(itemRef.current?.hash);
  const [confirmed, setConfirmed] = useState<{
    hash: Hex;
    functionName: string;
  }>();
  useEffect(() => {
    const p = window.ethereum;
    if (!p) return;
    // After Disconnect the page takes no account until Connect wallet.
    const accounts = (a: Address[]) => {
      accountVersion.current++;
      if (!disconnected.current) setAccount(a[0]);
    };
    const network = (n: string) => setChainId(Number(n));
    const version = accountVersion.current;
    p.request({ method: "eth_accounts" })
      .then((a) => {
        // A later wallet event or user action takes precedence over this read.
        if (version === accountVersion.current) accounts(a);
      })
      .catch(() => {});
    p.request({ method: "eth_chainId" })
      .then(network)
      .catch(() => {});
    p.on?.("accountsChanged", accounts);
    p.on?.("chainChanged", network);
    return () => {
      accountVersion.current++;
      p.removeListener?.("accountsChanged", accounts);
      p.removeListener?.("chainChanged", network);
    };
  }, []);
  async function connect() {
    if (connectingLock.current) return;
    connectingLock.current = true;
    accountVersion.current++;
    const version = ++connectVersion.current;
    setConnecting(true);
    try {
      if (!window.ethereum)
        throw new Error("Open this page in your wallet app's browser");
      const a = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      // Disconnect was pressed while the wallet was asked: it stands.
      if (version !== connectVersion.current) return;
      if (a[0]) {
        disconnected.current = false;
        try {
          localStorage.removeItem(disconnectedKey);
        } catch {
          /* storage unavailable */
        }
      }
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
  // Forget the wallet on this page only; a reload stays disconnected.
  function disconnect() {
    if (sending.current) return;
    accountVersion.current++;
    connectVersion.current++;
    disconnected.current = true;
    try {
      localStorage.setItem(disconnectedKey, "1");
    } catch {
      /* the ref above still holds for this visit */
    }
    setAccount(undefined);
    setHash(undefined);
    setMessage(
      "Wallet disconnected from this page. To use another wallet, switch the address in your wallet app, then press Connect wallet.",
    );
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
  // Asks the wallet to list BASK with its logo (EIP-747 wallet_watchAsset).
  // The token is added on the wallet's current network, so the chain check
  // comes first. No signature, no transaction.
  async function addToWallet() {
    try {
      const p = window.ethereum;
      if (!p) throw new Error("Open this page in your wallet app's browser");
      if (Number(await p.request({ method: "eth_chainId" })) !== 4663)
        await switchChain();
      if (Number(await p.request({ method: "eth_chainId" })) !== 4663)
        throw new Error(
          "Switch your wallet to Robinhood Chain (4663), then press Add BASK to MetaMask again.",
        );
      const added = await p.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: VAULT,
            symbol: "BASK",
            decimals: 18,
            image: BASK_IMAGE,
          },
        },
      });
      setMessage(
        added
          ? "The wallet accepted the request to list BASK."
          : "The wallet did not add BASK.",
      );
    } catch (e) {
      setMessage(explain(e));
    }
  }
  async function send(s: Spec, key = s.functionName, label = key, afterItem?: () => Promise<void>) {
    const item = "itemAction" in s; // SPEC 6: explicit ITEM context, never inferred from claim name.
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
      // 2026-10-17, pre-launch review: an ITEM send waits for the earlier one to be mined, replaced or passed by its nonce.
      if (item) { const earlier = await itemPending(); if (earlier) throw new PendingTransaction(ITEM_PENDING, earlier); }
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
      if (s.functionName === "listGenesis") await listingPending();
      else if (!item) await sendPending(key); // 2026-10-17, v22 rebase: the vault settle, for vault sends; an ITEM send settled its own record above.
      // SPEC 6: ITEM target code check; the vault path is unchanged.
      if (item) await checkItemSend(s);
      else await verifyNetwork();
      await simulate(s, account);
      const gas = !item && ["deposit", "redeem", "claim"].includes(s.functionName) // SPEC 6: no vault gas branch for ITEM.
        ? ((await client.estimateGas({
            account,
            to: s.address,
            data: encode(s),
          })) *
            130n +
            99n) /
          100n
        : undefined;
      const nonce = await client.getTransactionCount({
        address: account,
        blockTag: "pending",
      });
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
            ...(s.value !== undefined ? { value: `0x${s.value.toString(16)}` } : {}), // 2026-10-16, Add liquidity build: ITEM-only ETH value.
          },
        ],
      })) as Hex;
      sent = tx;
      setHash(tx);
      const record = { hash: tx, account, functionName: s.functionName, nonce };
      // 2026-10-17, round-3 review: an ITEM send keeps a saved record of its own; the vault's slot is written by vault sends only.
      if (item) {
        itemRef.current = record;
        try {
          sessionStorage.setItem(itemPendingKey, JSON.stringify(record));
        } catch {
          /* storage unavailable */
        }
      } else {
        pendingRef.current = record;
        try {
          sessionStorage.setItem(pendingKey, JSON.stringify(pendingRef.current));
        } catch {
          /* nonce guard also protects reloads */
        }
      }
      report(key, {
        message: `${label}: Submitted. Waiting for confirmation…`,
        hash: tx,
      });
      // A Speed up (repriced) still runs this call; a cancel or a different
      // transaction on the same nonce (cancelled/replaced) does not.
      let replaced: string | undefined;
      const receipt = await client.waitForTransactionReceipt({
        hash: tx,
        timeout: 180_000,
        pollingInterval: 3000,
        onReplaced: (r) => {
          replaced = r.reason;
        },
      });
      settled = true;
      if (item) {
        itemRef.current = undefined;
        try {
          sessionStorage.removeItem(itemPendingKey);
        } catch {
          /* storage unavailable */
        }
        setUnresolved(undefined); // 2026-10-17, round-4 review: this send's own receipt; the record it wrote is gone.
      } else {
        pendingRef.current = undefined;
        try {
          sessionStorage.removeItem(pendingKey);
        } catch {
          /* storage unavailable */
        }
      }
      if (replaced === "cancelled" || replaced === "replaced")
        throw new TransactionCancelled(
          item ? "The transaction did not run. Refresh before retrying." : // SPEC 6: no vault words for ITEM.
          replaced === "cancelled"
            ? "The transaction was cancelled in the wallet; it did not run. Refresh the vault before retrying."
            : "The transaction was replaced in the wallet by a different one; it did not run. Refresh the vault before retrying.",
        );
      // After a Speed up the transaction is mined under another hash than the
      // one the wallet returned: from here on the mined one is shown and read.
      const mined = receipt.transactionHash;
      sent = mined;
      setHash(mined);
      if (receipt.status !== "success")
        throw new Error(
          "The transaction reverted. Refresh the data before retrying.",
        );
      setConfirmed({ hash: mined, functionName: s.functionName });
      report(key, { message: `${label}: Confirmed. Refreshing…`, hash: mined });
      // SPEC 6: refresh only the ITEM page; never run vault owed/proposal follow-ups.
      if (item) {
        await afterItem?.();
        report(key, { message: `${label}: Confirmed.`, hash: mined });
        return receipt;
      }
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
          const { id, executableAt, expiresAt } = event.args as any;
          detail = `Proposal ${id}; executable from ${date(executableAt)} until just before ${date(expiresAt, "end")}, from the Proposed event.`;
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
          detail =
            `Still owed to ${creditor}: ` +
            (fresh.complete
              ? remaining.join("; ") || "Nothing owed."
              : "Stock list unreadable — Retry vault.");
        }
      } catch {
        detail =
          "Refresh unreadable. Retry vault / claims to read the confirmed result.";
      }
      report(key, { message: `${label}: Confirmed.`, hash: mined, detail });
      return receipt;
    } catch (e) {
      if (e instanceof TransactionCancelled) {
        // No link: the submitted transaction never ran.
        notice(key, e.message);
        throw e;
      }
      if (e instanceof PendingTransaction) {
        report(key, { message: e.message, hash: e.hash });
        throw new InputError(e.message);
      }
      const message = item ? itemError(e) : await explainAction(e, s); // SPEC 6: vault decoding is vault-only.
      const status =
        sent && !settled
          ? "Receipt timed out or unreadable. This transaction may still be pending. Wait for its receipt before retrying."
          : message;
      if (item && sent && !settled) setUnresolved(sent); // 2026-10-17, pre-launch review: ITEM actions wait for this hash.
      if (sent && !settled && s.functionName === "listGenesis")
        pendingShown.current = true;
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
    notice,
    listingPending,
    waitPending,
    itemPending,
    unresolved,
    chainId,
    message,
    hash,
    busy,
    confirmed,
    connect,
    disconnect,
    switchChain,
    addToWallet,
    send,
    setMessage,
  };
}
export type Wallet = ReturnType<typeof useWallet>;
