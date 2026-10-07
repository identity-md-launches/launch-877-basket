import { zeroAddress, reasons } from "./chain";
import { fmt, usd, navOf, age, date, type Snapshot, type Asset } from "./model";
import { AddressLink, Empty, Note } from "./components";
import { Storefront } from "./Scenery";
export function faultName(s: Snapshot, a: string) {
  return a === zeroAddress
    ? "none"
    : s.assets.find((t) => t.token.toLowerCase() === a.toLowerCase())?.symbol +
        " (" +
        a +
        ")";
}
export function DepositState({
  asset,
  snapshot,
}: {
  asset: Asset;
  snapshot: Snapshot;
}) {
  if (!asset.open || asset.retired) return <span>Not open for deposits</span>;
  const s = asset.status;
  if (!s || !s.ok)
    return <span className="error">Deposit status: unreadable</span>;
  return s.value[0] === 0 ? (
    <span>Taking deposits now</span>
  ) : (
    <>
      <span>{reasons[s.value[0]] ?? `Unknown reason ${s.value[0]}`}</span>
      <small>
        Stock at fault:{" "}
        {s.value[1] === zeroAddress
          ? "none"
          : (snapshot.assets.find(
              (a) => a.token.toLowerCase() === s.value[1].toLowerCase(),
            )?.symbol ?? s.value[1])}
      </small>
    </>
  );
}
export function VaultPage({ snapshot: s }: { snapshot: Snapshot }) {
  const { nav, stale } = navOf(s.assets, s.complete);
  const g = s.globals;
  const per =
    nav !== undefined && g.totalSupply > 0n
      ? (nav * 10n ** 18n) / g.totalSupply
      : undefined;
  const capPercent =
    nav !== undefined && g.NAV_CAP > 0n
      ? Number((nav * 10000n) / g.NAV_CAP) / 100
      : 0;
  return (
    <>
      <section className="vault-hero">
        <div>
          <p className="eyebrow">Basket Protocol · Stock Token vault</p>
          <h1 tabIndex={-1}>
            A basket of stocks.
            <br />
            <em>One BASK.</em>
          </h1>
          <p>
            Deposit Stock Tokens. Hold Basket. Redeem a share of every stock in
            the vault.
          </p>
          <div className="hero-actions">
            <a href="#deposit" className="button primary">
              Deposit Stock Tokens <span aria-hidden="true">↗</span>
            </a>
            <a href="#redeem" className="button">
              Redeem BASK
            </a>
          </div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <Storefront />
          <div className="store-sign"><span>Basket</span><strong>BASK</strong></div>
        </div>
      </section>
      <div className="stats">
        <section className="price-tag">
          <span className="eyebrow">Total vault NAV</span>
          <strong className="metric">{usd(nav)}</strong>
          <span>
            {stale
              ? "Stale · held stock price over 26 hours old"
              : "Managed Stock Tokens only"}
          </span>
        </section>
        <section className="price-tag">
          <span className="eyebrow">NAV per BASK</span>
          <strong className="metric">
            {g.totalSupply === 0n ? "—" : usd(per)}
          </strong>
          <span>
            {g.totalSupply === 0n
              ? "No BASK in circulation"
              : stale
                ? "Stale · based on stale NAV"
                : `${fmt(g.totalSupply)} BASK in circulation`}
          </span>
        </section>
        <section className="price-tag">
          <span className="eyebrow">NAV / cap</span>
          <strong className="metric cap-value">
            {usd(nav)} <span>/ {usd(g.NAV_CAP)}</span>
          </strong>
          <div
            className="meter"
            role="meter"
            aria-label="NAV cap used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(capPercent, 100)}
          >
            <span style={{ width: `${Math.min(capPercent, 100)}%` }} />
          </div>
          <span>
            {stale ? "Stale · " : ""}
            {nav !== undefined && g.NAV_CAP !== undefined
              ? g.NAV_CAP === 0n
                ? "Cap is zero"
                : `${capPercent.toFixed(2)}% used`
              : "unreadable"}
          </span>
        </section>
      </div>
      <section className="shelf">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Inside the basket</p>
            <h2>
              Stock Tokens{" "}
              <span className="count">
                {s.complete ? s.assets.length : "?"}
              </span>
            </h2>
          </div>
          <span className="badge">
            {g.genesisFinalized === false
              ? "Preparing for launch"
              : g.depositsPaused === true
                ? "Deposits paused"
                : g.genesisFinalized === true
                  ? "Genesis finalized"
                  : "Status unreadable"}
          </span>
        </div>
        <p className="muted">
          Monday to Friday, 15:30 to 19:30 UTC, closed on US market holidays.
        </p>
        {g.genesisFinalized && (
          <p className="muted">
            Deposit opening time: {date(g.depositsOpenAt)}. Current availability
            appears for each open stock.
          </p>
        )}
        {!s.assets.length ? (
          <Empty
            title={
              s.complete
                ? "The shelves are not stocked yet"
                : "Stocks are unreadable"
            }
          >
            {s.complete ? (
              <>
                The owner can list Stock Tokens and finalize genesis on the{" "}
                <a href="#owner">Owner page</a>. Deposits open 72 hours after
                finalization.
              </>
            ) : (
              "Refresh the vault data to try again."
            )}
          </Empty>
        ) : (
          <div className="stock-grid">
            {s.assets.map((a) => {
              const value = a.retired
                ? 0n
                : a.managed === 0n
                  ? 0n
                  : a.managed !== undefined &&
                      a.feedReadable &&
                      a.answer !== undefined &&
                      a.answer > 0n
                    ? (a.managed * a.answer) / 100000000n
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
                  <p className="stock-price">
                    {a.feedReadable && a.answer !== undefined
                      ? "$" + fmt(a.answer, 8, 4)
                      : "unreadable"}
                  </p>
                  <p className="muted">
                    {a.feedReadable
                      ? age(a.updatedAt)
                      : "Price age: unreadable"}
                    {a.feedReadable &&
                    a.updatedAt !== undefined &&
                    Date.now() / 1000 - Number(a.updatedAt) > 26 * 3600
                      ? " · stale"
                      : ""}
                  </p>
                  <dl>
                    <div>
                      <dt>Share of NAV</dt>
                      <dd>
                        {value === undefined || nav === undefined
                          ? "unreadable"
                          : nav === 0n
                            ? "—"
                            : `${fmt((value * 10000n) / nav, 2, 2)}%`}
                        {stale ? " · stale" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Short</dt>
                      <dd>
                        {!a.balanceReadable || a.short === undefined
                          ? "unreadable"
                          : a.short
                            ? "Yes"
                            : "No"}
                      </dd>
                    </div>
                    <div>
                      <dt>Amount owed</dt>
                      <dd>{fmt(a.totalOwed)}</dd>
                    </div>
                  </dl>
                  <div className="stock-deposits">
                    <DepositState asset={a} snapshot={s} />
                  </div>
                  <AddressLink value={a.token} />
                </article>
              );
            })}
          </div>
        )}
        <Note>
          A retired stock counts 0 in NAV and for new deposits but is still paid
          out on redemption.
        </Note>
      </section>
    </>
  );
}
