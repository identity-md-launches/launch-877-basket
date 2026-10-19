import { Activity, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { chain, verifyNetwork, VAULT } from "./chain";
import { initial, loadSnapshot } from "./model";
import { useWallet } from "./wallet";
import { AddressLink, BasketIcon } from "./components";
import { VaultPage } from "./Vault";
import { DepositPage, RedeemPage, Claims } from "./Flows";
import { OwnerPage } from "./Owner";
import { DocsPage } from "./Docs";
import { LossesPage } from "./Losses";
// SPEC 3: ITEM routes are mounted only while open.
import { EarnPage } from "./Earn";
import { TransparencyPage } from "./Transparency";
import { Marquee, StoreShelf } from "./Scenery";
import "./styles.css";
const pages = ["Vault", "Deposit", "Redeem", "Earn", "Docs"];
const routes = [...pages, "Owner", "Losses", "Transparency"];
function currentPage() {
  const p = location.hash.slice(1).toLowerCase();
  return routes.find((n) => n.toLowerCase() === p) ?? "Vault";
}
function App() {
  const [page, setPage] = useState(currentPage);
  const [snapshot, setSnapshot] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++revision.current;
    setLoading(true);
    setError("");
    try {
      try {
        await verifyNetwork();
      } catch (e) {
        if (id === revision.current) setError((e as Error).message);
      }
      const s = await loadSnapshot();
      if (id === revision.current) setSnapshot(s);
      return s;
    } catch (e) {
      if (id === revision.current)
        setError("Vault data: unreadable. Retry vault.");
      throw e;
    } finally {
      if (id === revision.current) setLoading(false);
    }
  }, []);
  const wallet = useWallet(refresh);
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);
  useEffect(() => {
    const handler = () => {
      setPage(currentPage());
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("h1")?.focus(),
      );
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const data = {
    ...snapshot,
    loading,
    retry: () => {
      void refresh().catch(() => {});
    },
  };
  // Age/stale labels update locally without adding RPC traffic.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  // Unretired stocks the vault holds less of than it manages: while any is
  // short, the vault refuses deposits.
  const shortStocks = snapshot.assets.filter((a) => a.short && !a.retired);
  return (
    <>
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="restriction">
        <span className="restriction-mark" aria-hidden="true">
          !
        </span>
        <p>
          Not for US persons. Stock Tokens are not offered in the United States
          and are restricted in other countries. Basket Protocol is not
          affiliated with the issuer of Stock Tokens.
        </p>
      </div>
      <header>
        <Marquee />
        <div className="header-inner">
          <a href="#vault" className="brand" aria-label="Basket Protocol home">
            <BasketIcon large />
            <span>
              Basket<span className="brand-sub">Protocol</span>
            </span>
          </a>
          <div className="wallet-area">
            <span className="chain-label">
              <span aria-hidden="true">●</span> Robinhood Chain
            </span>
            {wallet.account ? (
              <>
                <span className="connected-address" title={wallet.account}>
                  {wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}
                </span>
                <button
                  className="disconnect"
                  onClick={wallet.disconnect}
                  disabled={wallet.busy}
                >
                  Disconnect
                </button>
                {wallet.chainId !== 4663 && (
                  <button onClick={wallet.switchChain}>
                    Switch to chain 4663
                  </button>
                )}
              </>
            ) : (
              <button onClick={wallet.connect} disabled={wallet.connecting}>
                {wallet.connecting ? "Connecting..." : "Connect wallet"}{" "}
                <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </div>
        <nav aria-label="Primary navigation">
          <div>
            {pages.map((p) => (
              <a
                key={p}
                href={"#" + p.toLowerCase()}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </a>
            ))}
          </div>
        </nav>
      </header>
      <div className="shop-window">
        <StoreShelf />
      </div>
      <main id="main-content" tabIndex={-1}>
        <div className="data-bar">
          <span role="status">
            {loading
              ? "Reading the vault…"
              : snapshot.loadedAt
                ? "Read from chain · " +
                  new Date(snapshot.loadedAt).toLocaleTimeString("en-GB", {
                    timeZone: "UTC",
                  }) +
                  " UTC"
                : "Vault data unreadable"}
          </span>
          <button
            className="refresh"
            disabled={loading}
            onClick={() => {
              void refresh().catch(() => {});
            }}
          >
            {loading
              ? "Reading..."
              : error || snapshot.errors.length
                ? "Retry vault"
                : "Refresh vault"}{" "}
            <span aria-hidden="true">↻</span>
          </button>
        </div>
        {!window.ethereum && (
          <div className="note wallet-help">
            Open this page in your wallet app's browser
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  wallet.setMessage("Site link copied.");
                } catch {
                  wallet.setMessage(`Copy this site link: ${location.href}`);
                }
              }}
            >
              Copy site link
            </button>
          </div>
        )}
        {error && (
          <div className="note warning" role="alert">
            {error}
          </div>
        )}
        {snapshot.errors.length > 0 && (
          <details className="read-errors">
            <summary>
              {snapshot.errors.length} read issue
              {snapshot.errors.length === 1 ? "" : "s"} · other data remains
              available
            </summary>
            {snapshot.errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </details>
        )}
        <div
          className={
            "wallet-status" +
            (Object.values(wallet.progress).some(
              (p) => p.message === wallet.message,
            )
              ? " transaction-summary"
              : "")
          }
          role="status"
        >
          {wallet.message}
          {wallet.hash && (
            <>
              {" "}
              <a
                href={`${chain.blockExplorers.default.url}/tx/${wallet.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction
              </a>
            </>
          )}
        </div>
        {wallet.account && wallet.chainId !== 4663 && (
          <div className="note warning">
            Your wallet must be on Robinhood Chain (4663) to send. Public data
            remains available.
          </div>
        )}
        {(page === "Vault" || page === "Deposit") && shortStocks.length > 0 && (
          <div className="note warning">
            Deposits are paused: the vault is short of{" "}
            <bdi>{shortStocks.map((a) => a.symbol).join(", ")}</bdi>.{" "}
            <a href="#losses">Anyone can start the fix.</a>
          </div>
        )}
        {page === "Vault" ? (
          <VaultPage snapshot={data} />
        ) : page === "Deposit" ? (
          <DepositPage snapshot={data} wallet={wallet} />
        ) : page === "Redeem" ? (
          <RedeemPage snapshot={data} wallet={wallet} />
        ) : page === "Earn" ? (
          <EarnPage snapshot={data} wallet={wallet} />
        ) : page === "Transparency" ? (
          <TransparencyPage snapshot={data} />
        ) : page === "Owner" ? (
          <OwnerPage snapshot={data} wallet={wallet} />
        ) : page === "Docs" ? (
          <DocsPage onAddToWallet={wallet.addToWallet} />
        ) : (
          <LossesPage snapshot={data} wallet={wallet} />
        )}
        <Activity mode={page === "Redeem" ? "visible" : "hidden"}>
          <Claims key={wallet.account} snapshot={data} wallet={wallet} />
        </Activity>
      </main>
      <div className="floor-strip" aria-hidden="true" />
      <footer>
        <div>
          <BasketIcon />
          <strong>Basket Protocol</strong>
          <span className="footer-links">
            <a
              href="#owner"
              aria-current={page === "Owner" ? "page" : undefined}
            >
              Owner controls
            </a>
            <a href="#transparency" aria-current={page === "Transparency" ? "page" : undefined}>Transparency</a>
            <a href="#docs">Docs</a>
            <a href="https://x.com/Basket_IMD" target="_blank" rel="noreferrer">
              Basket Protocol on X
            </a>
            <a href="https://t.me/basket_protocol" target="_blank" rel="noreferrer">
              Basket Protocol on Telegram
            </a>
            <a href="https://medium.com/@protocolbasket" target="_blank" rel="noreferrer">
              Basket Protocol on Medium
            </a>
            <a href="mailto:protocolbasket@gmail.com">protocolbasket@gmail.com</a>
          </span>
        </div>
        <div>
          <span>BaskVault · Chain 4663</span>
          <AddressLink value={VAULT} />
        </div>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
