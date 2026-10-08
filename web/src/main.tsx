import { useCallback, useEffect, useState } from "react";
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
import { Marquee, StoreShelf } from "./Scenery";
import "./styles.css";
const pages = ["Vault", "Deposit", "Redeem", "Docs"];
const routes = [...pages, "Owner", "Losses"];
function currentPage() {
  const p = location.hash.slice(1).toLowerCase();
  return routes.find((n) => n.toLowerCase() === p) ?? "Vault";
}
function App() {
  const [page, setPage] = useState(currentPage);
  const [snapshot, setSnapshot] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((x) => x + 1), []);
  const wallet = useWallet(refresh);
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
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        await verifyNetwork();
      } catch (e) {
        if (active) setError((e as Error).message);
      }
      try {
        const s = await loadSnapshot();
        if (active) setSnapshot(s);
      } catch {
        if (active) setError("Vault data: unreadable. Refresh to retry.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [revision]);
  // Age/stale labels update locally without adding RPC traffic.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
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
                {wallet.chainId !== 4663 && (
                  <button onClick={wallet.switchChain}>
                    Switch to chain 4663
                  </button>
                )}
              </>
            ) : (
              <button onClick={wallet.connect}>
                Connect wallet <span aria-hidden="true">↗</span>
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
          <button className="refresh" disabled={loading} onClick={refresh}>
            Retry vault <span aria-hidden="true">↻</span>
          </button>
        </div>
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
        <div className="wallet-status" role="status">
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
        {page === "Vault" ? (
          <VaultPage snapshot={snapshot} />
        ) : page === "Deposit" ? (
          <DepositPage snapshot={snapshot} wallet={wallet} />
        ) : page === "Redeem" ? (
          <RedeemPage snapshot={snapshot} wallet={wallet} />
        ) : page === "Owner" ? (
          <OwnerPage snapshot={snapshot} wallet={wallet} />
        ) : page === "Docs" ? (
          <DocsPage />
        ) : (
          <LossesPage snapshot={snapshot} wallet={wallet} />
        )}
        {page === "Redeem" && <Claims snapshot={snapshot} wallet={wallet} />}
      </main>
      <div className="floor-strip" aria-hidden="true" />
      <footer>
        <div>
          <BasketIcon />
          <strong>Basket Protocol</strong>
          <span>Stock Tokens. One basket.</span>
          <span className="footer-links">
            <a
              href="#owner"
              aria-current={page === "Owner" ? "page" : undefined}
            >
              Owner controls
            </a>
            <a
              href="#losses"
              aria-current={page === "Losses" ? "page" : undefined}
            >
              Losses
            </a>
            <a href="#docs">Docs</a>
            <a href="https://x.com/Basket_IMD" target="_blank" rel="noreferrer">
              Basket Protocol on X
            </a>
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
