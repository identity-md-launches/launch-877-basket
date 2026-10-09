import { useState } from "react";
import { VAULT, zeroAddress, reasons } from "./chain";
import {
  navOf,
  assetValue,
  fmt,
  usd,
  age,
  pairingMatches,
  hoursWords,
  type Snapshot,
} from "./model";
import { PageTitle, AddressLink, Note, Empty } from "./components";
import { StoreShelf } from "./Scenery";
export function DepositState({ snapshot: s }: { snapshot: Snapshot }) {
  const r = s.status;
  return (
    <div className="deposit-state">
      <strong>Vault deposit status</strong>
      <p>
        {s.loading
          ? "Reading..."
          : !s.assets.length &&
              s.complete &&
              s.globals.genesisFinalized === false
            ? "No Stock Tokens are listed yet. Deposits start after the owner finishes setup."
            : s.assets.length > 0 &&
                s.assets.every((a) => !a.open || a.retired) &&
                s.globals.genesisFinalized
              ? "Every stock is closed. The owner must reopen a stock before deposits."
              : !r || !r.ok
                ? "unreadable — Retry vault"
                : (reasons[Number(r.value[0])] ?? "unreadable")}
      </p>
      {r?.ok && r.value[1] !== zeroAddress && (
        <p>
          Stock at fault:{" "}
          {s.assets.find(
            (a) => a.token.toLowerCase() === r.value[1].toLowerCase(),
          )?.symbol ?? r.value[1]}
        </p>
      )}
      <p>Hours: {s.loading ? "Reading..." : hoursWords(s.globals.settings)}</p>
      {!s.loading && (!r || !r.ok) && (
        <button onClick={s.retry}>Retry vault</button>
      )}
    </div>
  );
}
export function VaultPage({ snapshot: s }: { snapshot: Snapshot }) {
  const [search, setSearch] = useState("");
  const nav = navOf(s.assets, s.complete),
    supply = s.globals.totalSupply as bigint | undefined;
  return (
    <>
      <div className="vault-hero">
        <PageTitle
          eyebrow="Stock Tokens. One basket."
          title="A basket of stocks."
        >
          Meet Basket (BASK): your share of the Stock Tokens in this vault.
        </PageTitle>
        <div className="clerk-panel">
          <span className="burst">WOW!</span>
          <img className="character-picture" src="./art/character/vault.webp" width="606" height="1000" alt="Cheerful store worker beside a produce crate" />
          <p className="speech-bubble">I was hoping you would come through my aisle</p>
        </div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Inside the basket</h2>
          <span className="eyebrow">On-chain figures</span>
        </div>
        <div className="stats">
          <div>
            <span>NAV{nav.indicative ? " · indicative" : ""}</span>
            <strong>{s.loading ? "Reading..." : usd(nav.nav)}</strong>
          </div>
          <div>
            <span>NAV per BASK</span>
            <strong>
              {s.loading
                ? "Reading..."
                : supply === undefined || nav.nav === undefined
                  ? "unreadable"
                  : supply === 0n
                    ? "No BASK issued"
                    : usd((nav.nav * 10n ** 18n) / supply)}
            </strong>
          </div>
          <div>
            <span>BASK supply</span>
            <strong>{s.loading ? "Reading..." : fmt(supply)}</strong>
          </div>
          <div>
            <span>Size limit</span>
            <strong>{s.loading ? "Reading..." : usd(s.globals.NAV_CAP)}</strong>
          </div>
        </div>
        {nav.indicative && (
          <Note warning>
            NAV is indicative: at least one held stock has a price reason other
            than OK, or an unreadable reason.
          </Note>
        )}
        <div className="two-col">
          <DepositState snapshot={s} />
          <div>
            <strong>Fees</strong>
            <p>
              {s.loading
                ? "Reading..."
                : s.globals.feeRecipient === undefined
                  ? "Fee recipient unreadable — Retry vault"
                  : s.globals.feeRecipient === zeroAddress
                    ? "no fees yet"
                    : "0.5% on deposit and 0.5% on redemption"}
            </p>
            <p>BaskVault · Robinhood Chain</p>
            <AddressLink value={VAULT} />
          </div>
        </div>
      </section>
      <section className="panel stock-section">
        <div className="section-heading">
          <h2>Stock shelves</h2>
          <span className="burst small">Fresh!</span>
        </div>
        <StoreShelf />
        {!!s.assets.length && (
          <label className="stock-search">
            Search stocks
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        )}
        {!s.assets.length ? (
          <Empty
            title={
              s.loading
                ? "Reading..."
                : s.complete
                  ? "No Stock Tokens are listed yet."
                  : "Stocks unreadable"
            }
          >
            {s.loading
              ? "Please wait for current vault data."
              : s.complete
                ? "Deposits start after the owner finishes setup."
                : "Retry the vault for current data."}
          </Empty>
        ) : (
          <div className="stock-grid">
            {s.assets
              .filter(
                (a) =>
                  a.symbol.toLowerCase().includes(search.toLowerCase()) ||
                  a.token.toLowerCase().includes(search.toLowerCase()),
              )
              .map((a) => {
                const value = assetValue(a),
                  feedPrice =
                    a.answer === undefined
                      ? undefined
                      : (a.answer * 10n ** 18n) / 10n ** BigInt(a.feedDecimals);
                const gap =
                  a.poolPrice && feedPrice
                    ? Number(((a.poolPrice - feedPrice) * 10000n) / feedPrice) /
                      100
                    : undefined;
                return (
                  <article className="stock-card" key={a.token}>
                    <div className="stock-top">
                      <h3>
                        <bdi>{a.symbol}</bdi>
                      </h3>
                      <span className="badge">
                        {a.retired ? "Retired" : a.open ? "Open" : "Closed"}
                      </span>
                    </div>
                    {!pairingMatches(a.symbol, a.description) && (
                      <p className="pairing-warning">check this pairing</p>
                    )}
                    <dl>
                      <div>
                        <dt>Held (managed)</dt>
                        <dd>{fmt(a.managed, a.tokenDecimals)}</dd>
                      </div>
                      <div>
                        <dt>Share of NAV</dt>
                        <dd>
                          {nav.nav === undefined || value === undefined
                            ? "unreadable"
                            : nav.nav === 0n
                              ? "—"
                              : fmt((value * 10000n) / nav.nav, 2, 2) + "%"}
                        </dd>
                      </div>
                      {a.reason !== 0 && (
                        <div>
                          <dt>Price reason</dt>
                          <dd>
                            {a.reason === undefined
                              ? "unreadable"
                              : reasons[a.reason]}
                          </dd>
                        </div>
                      )}
                      {(!a.balanceReadable || a.short) && (
                        <div>
                          <dt>Balance check</dt>
                          <dd>
                            {!a.balanceReadable
                              ? "unreadable"
                              : a.short
                                ? "vault short of this stock"
                                : "Readable; no shortfall"}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <details>
                      <summary>Details</summary>{" "}
                      <p className="chain-text">
                        <bdi>{a.description}</bdi>
                      </p>
                      <dl>
                        {" "}
                        <div>
                          <dt>Feed price / age</dt>
                          <dd>
                            {a.answer === undefined || a.answer <= 0n
                              ? "unreadable / invalid feed"
                              : "$" + fmt(a.answer, a.feedDecimals)}
                            <small>{age(a.updatedAt)}</small>
                          </dd>
                        </div>
                        <div>
                          <dt>Pool check</dt>
                          <dd>
                            {[9, 10, 11].includes(a.reason ?? -1)
                              ? "not run"
                              : a.poolPrice === undefined
                                ? "unreadable"
                                : a.pool === zeroAddress
                                  ? "No pool; feed-age check"
                                  : a.poolPrice === 0n
                                    ? "Failed · poolPrice 0"
                                    : `${usd(a.poolPrice)} · ${gap === undefined ? "gap unreadable" : `${gap > 0 ? "+" : ""}${gap}% vs feed`}`}
                          </dd>
                        </div>
                        <div>
                          <dt>Owed</dt>
                          <dd>{fmt(a.totalOwed, a.tokenDecimals)}</dd>
                        </div>
                      </dl>
                      <AddressLink value={a.token} />
                      <AddressLink value={a.feed} />
                    </details>
                  </article>
                );
              })}
          </div>
        )}
      </section>
    </>
  );
}
