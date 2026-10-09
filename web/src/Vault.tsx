import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { VAULT, zeroAddress, reasonWords } from "./chain";
import {
  navOf,
  assetValue,
  fmt,
  usd,
  pairingMatches,
  hoursWords,
  type Asset,
  type Snapshot,
} from "./model";
import { PageTitle, AddressLink, Note, Empty } from "./components";
import { StoreShelf } from "./Scenery";
import {
  countdown,
  inside,
  nextOpening,
  nyDate,
  weekdayWords,
  zoneWords,
} from "./newYork";
export const mayBeOpen = "Deposits may be open now. Press Refresh vault.";
// The reopen time in the viewer's own zone, in words (no seconds, no numeric date).
export const localWords = (t: bigint) =>
  new Date(Number(t) * 1000).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
// Next opening as the contract sees it at the read block, when reason 3 still
// holds there; undefined when the read block is already inside the hours.
export function reopenAt(
  settings: any,
  blockTime: bigint | undefined,
): bigint | undefined {
  if (!settings || blockTime === undefined) return undefined;
  const from = BigInt(settings.hoursFrom),
    to = BigInt(settings.hoursTo),
    dst = BigInt(settings.dst);
  if (inside(blockTime, from, to, dst)) return undefined;
  return nextOpening(blockTime, from, dst);
}
// Reason 3 (Hours) and 14 (Freshness) in words; computed like the contract from
// settings() and the latest block timestamp, never the browser time zone.
// now = the read block time plus the seconds since that read.
export function closedWords(
  reason: number,
  settings: any,
  blockTime: bigint | undefined,
  now = blockTime,
): string | undefined {
  if (!settings) return undefined;
  if (reason === 14)
    return `Deposits are closed until stock prices update (at least ${settings.freshCount} must have updated in the last ${settings.freshHours} hour(s), e.g. a US market holiday); no set time. Redemptions are always open.`;
  if (reason !== 3 || blockTime === undefined || now === undefined)
    return undefined;
  // Status and block read on different blocks at the boundary.
  const t = reopenAt(settings, blockTime);
  if (t === undefined || now >= t) return mayBeOpen;
  const from = BigInt(settings.hoursFrom),
    dst = BigInt(settings.dst);
  const holiday =
    BigInt(settings.freshCount) > 0n
      ? " On a US market holiday they reopen when prices update."
      : "";
  return `Deposits reopen ${weekdayWords(from)} ${zoneWords(dst)} (${nyDate(t, dst)}, in ${countdown(t - now)}; your time ${localWords(t)}).${holiday} Redemptions are always open.`;
}
// Vault and Deposit pages: words only (the Owner page adds the raw seconds).
export function hoursLine(settings: any): string {
  return hoursWords(settings);
}
// The vault clock now, re-rendered when the countdown's minute changes; once
// the reopen time passes, the vault is read again (as Refresh vault does).
function useVaultClock(s: Snapshot, closedForHours: boolean) {
  const [, tick] = useState(0);
  const refreshed = useRef<bigint | undefined>(undefined);
  const now =
    s.blockTime === undefined
      ? undefined
      : s.blockTime +
        BigInt(
          Math.max(
            0,
            Math.floor((Date.now() - (s.blockReadAt ?? s.loadedAt)) / 1000),
          ),
        );
  const opening = closedForHours
    ? reopenAt(s.globals.settings, s.blockTime)
    : undefined;
  useEffect(() => {
    if (opening === undefined || now === undefined) return;
    const left = opening - now;
    if (left <= 0n) {
      // One automatic re-read per reopen time; then the words ask for Refresh.
      if (refreshed.current !== opening) {
        refreshed.current = opening;
        s.retry?.();
      }
      return;
    }
    // The minutes shown change once left drops below a whole minute.
    const next = (left % 60n) + 1n;
    const wait = left < next ? left : next;
    const timer = setTimeout(() => tick((x) => x + 1), Number(wait) * 1000);
    return () => clearTimeout(timer);
  });
  return now;
}
export function DepositState({ snapshot: s }: { snapshot: Snapshot }) {
  const r = s.status;
  const reason = r?.ok && !s.loading ? Number(r.value[0]) : undefined;
  const now = useVaultClock(s, reason === 3);
  const closed =
    reason !== undefined
      ? closedWords(reason, s.globals.settings, s.blockTime, now)
      : undefined;
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
                : reasonWords(Number(r.value[0]), s.globals.settings)}
      </p>
      {r?.ok && r.value[1] !== zeroAddress && (
        <p>
          Stock at fault:{" "}
          {s.assets.find(
            (a) => a.token.toLowerCase() === r.value[1].toLowerCase(),
          )?.symbol ?? r.value[1]}
        </p>
      )}
      {closed && <p className="reopen">{closed}</p>}
      <p>Hours: {s.loading ? "Reading..." : hoursLine(s.globals.settings)}</p>
      {!s.loading && (!r || !r.ok) && (
        <button onClick={s.retry}>Retry vault</button>
      )}
    </div>
  );
}
export function VaultPage({ snapshot: s }: { snapshot: Snapshot }) {
  const nav = navOf(s.assets, s.complete),
    supply = s.globals.totalSupply as bigint | undefined;
  return (
    <>
      <PageTitle
        title="A basket of stocks."
        character={{
          kind: "vault",
          src: "./art/character/vault.webp",
          width: 606,
          height: 1000,
          alt: "Cheerful store worker beside a produce crate",
          line: "I was hoping you would come through my aisle",
        }}
      >
        Meet Basket (BASK): your share of the Stock Tokens in this vault.
      </PageTitle>
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
      <StockShelves snapshot={s} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Stock shelves: shelf-edge labels on a store shelf unit (display only; the
// snapshot is read exactly as before, nothing here reads, checks or sends).
// Two groups: "In the basket" (held, or held amount unreadable: full labels,
// biggest share first) and "On the shelf, not held" (held 0: compact labels,
// listing order; their held amount and share are in the details drawer).
// ---------------------------------------------------------------------------
type ShelfFilter = "all" | "open" | "closed" | "held";
const shelfFilters: [ShelfFilter, string][] = [
  ["all", "All"],
  ["open", "Open"],
  ["closed", "Closed"],
  ["held", "Held"],
];
const isHeld = (a: Asset) => a.managed !== undefined && a.managed > 0n;
function inShelfFilter(a: Asset, f: ShelfFilter) {
  if (f === "open") return !a.retired && a.open;
  if (f === "closed") return a.retired || !a.open;
  if (f === "held") return isHeld(a);
  return true;
}
// The price reason words come from reasonWords(reason, settings) (v9 F12: reason
// 12 names the vault's poolWindow and poolDeviation), as on the rest of the site;
// `settings` is the snapshot's settings() read, passed down from StockShelves.
// Plain-words status. Closed = the owner or guardian closed it to deposits
// (redemptions still pay it out). An OPEN stock whose price reason is not OK
// cannot be deposited right now: "Open · not taking deposits", never "Closed".
type ShelfKind = "open" | "paused" | "closed" | "retired" | "unknown";
function shelfStatus(a: Asset, settings: any): { kind: ShelfKind; more?: string } {
  if (a.retired) return { kind: "retired", more: "Retired: removed from the basket." };
  if (!a.open)
    return {
      kind: "closed",
      more: "Closed by the owner or guardian: no new deposits of this stock. Redemptions still pay it out.",
    };
  if (a.reason === 0) return { kind: "open" };
  if (a.reason === undefined)
    return { kind: "unknown", more: "Open, but its price reason is unreadable." };
  return {
    kind: "paused",
    more: `Open, but deposits of this stock are blocked right now: ${reasonWords(a.reason, settings)}.`,
  };
}
// The slim chip under the status: the price reason words when it is not OK.
function reasonChip(a: Asset, kind: ShelfKind, settings: any) {
  if (a.reason === 0) return undefined;
  const words = reasonWords(a.reason, settings);
  return kind === "paused" ? words : `price reason: ${words}`;
}
// Warnings printed on the label itself (white on red).
function shelfFlags(a: Asset): string[] {
  const flags: string[] = [];
  if (!pairingMatches(a.symbol, a.description)) flags.push("check this pairing");
  if (!a.balanceReadable) flags.push("Balance check: unreadable");
  else if (a.short) flags.push("Balance check: vault short of this stock");
  return flags;
}
// A label with a chip (a price reason or a warning), and a compact label that
// is closed (room for the stamp), is double width: its extra words fit without
// making its shelf row taller.
const hasChip = (a: Asset) => a.reason !== 0 || shelfFlags(a).length > 0;
const isWide = (a: Asset, mini: boolean) => hasChip(a) || (mini && !a.retired && !a.open);
const feedPrice18 = (a: Asset) =>
  a.answer === undefined
    ? undefined
    : (a.answer * 10n ** 18n) / 10n ** BigInt(a.feedDecimals);
const priceReadable = (a: Asset) => a.answer !== undefined && a.answer > 0n;
// reason 9 only (feed price missing or too old): its last price is shown dimmed
// with an "old price" tag. Reasons 10 (band) and 11 (issuer pause) come after the
// feed's age check, so their price is fresh: shown normally, the chip says why.
const staleFeed = (a: Asset) => a.reason === 9;
// Money on the labels is the site's usd(): cut to the cent, the same rule as the
// NAV figure above (one rule site-wide). The flyer price only prints usd()'s
// cents in two digits ("$669.5" shows as $669 and 50 cents).
function ShelfPrice({ a, stale }: { a: Asset; stale: boolean }) {
  if (!priceReadable(a)) return <p className="sa-price is-unreadable">price unreadable</p>;
  const t = usd(feedPrice18(a)),
    m = /^\$([\d,]+)(?:\.(\d{1,2}))?$/.exec(t);
  // flyer price: big dollars, small raised cents (the dot stays for screen readers and copying)
  return (
    <p className={stale ? "sa-price is-stale" : "sa-price"}>
      {m ? (
        <>
          <span className="sa-cur">$</span>
          {m[1]}
          <span className="sa-cents">
            <span className="sa-sr">.</span>
            {(m[2] ?? "").padEnd(2, "0")}
          </span>
        </>
      ) : (
        t
      )}
    </p>
  );
}
// No price time on the labels or in the drawer: feeds post only on a 0.5% move
// or every 24 hours, so an age like "17h 55m ago" looked stale when it was not.
// Only a price the vault refuses as too old (reason 9) gets the "old price" tag.
function OldPriceTag({ stale }: { stale: boolean }) {
  return stale ? (
    <p className="sa-age is-stale">
      <span className="sa-old">old price</span>
    </p>
  ) : null;
}
function shareText(value: bigint | undefined, nav: bigint | undefined) {
  return nav === undefined || value === undefined
    ? "unreadable"
    : nav === 0n
      ? "—"
      : fmt((value * 10000n) / nav, 2, 2) + "%";
}
// Today's pool check branching, unchanged.
function poolCheck(a: Asset): string {
  const feedPrice = feedPrice18(a);
  const gap =
    a.poolPrice && feedPrice
      ? Number(((a.poolPrice - feedPrice) * 10000n) / feedPrice) / 100
      : undefined;
  return [9, 10, 11].includes(a.reason ?? -1)
    ? "not run"
    : a.poolPrice === undefined
      ? "unreadable"
      : a.pool === zeroAddress
        ? "No pool; feed-age check"
        : a.poolPrice === 0n
          ? "Failed · poolPrice 0"
          : `${usd(a.poolPrice)} · ${gap === undefined ? "gap unreadable" : `${gap > 0 ? "+" : ""}${gap}% vs feed`}`;
}
// One-time "restocking": the first time a shelf row is about a third in view,
// its labels swing once on their clips, left to right (rows that come into view
// together follow one another). Each label starts and ends at rest, so nothing
// is ever hidden or blinks; every label is fully visible if this never runs.
// Off under reduced motion; stops for good once the visitor filters or searches.
const swingFrames: Keyframe[] = [
  { transform: "none" },
  { transform: "translateY(-12px) rotate(-6deg)", offset: 0.2 },
  { transform: "translateY(2px) rotate(3.5deg)", offset: 0.46 },
  { transform: "translateY(0) rotate(-1.8deg)", offset: 0.68 },
  { transform: "translateY(0) rotate(0.7deg)", offset: 0.86 },
  { transform: "none" },
];
function useRestock(ref: RefObject<HTMLDivElement | null>, ready: boolean) {
  const stopped = useRef(false),
    io = useRef<IntersectionObserver | undefined>(undefined);
  useEffect(() => {
    const box = ref.current;
    if (
      !ready ||
      stopped.current ||
      !box ||
      typeof IntersectionObserver === "undefined" ||
      typeof box.animate !== "function" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const swing = (hit: HTMLElement[]) => {
      const rows = [...new Set(hit.map((li) => Number(li.dataset.row)))].sort((x, y) => x - y);
      for (const li of hit) {
        obs.unobserve(li);
        (li.firstElementChild as HTMLElement | null)?.animate(swingFrames, {
          duration: 640,
          easing: "ease-out",
          delay: Math.min(rows.indexOf(Number(li.dataset.row)), 3) * 120 + Number(li.dataset.col) * 45,
        });
      }
    };
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
        if (hit.length && !stopped.current) swing(hit);
      },
      { threshold: 0.35 },
    );
    io.current = obs;
    for (const li of box.querySelectorAll<HTMLElement>(".sa-slot[data-row]")) obs.observe(li);
    return () => obs.disconnect();
  }, [ready, ref]);
  return () => {
    stopped.current = true;
    io.current?.disconnect();
  };
}
// How many labels fit in a row: the CSS grid decides (auto-fill), this reads it
// so the details drawer can open right under the tapped label's row. The count
// follows the list's own width (a ResizeObserver on it), so it also updates when
// the panel changes width without a window resize.
function useGridCols(ref: RefObject<HTMLUListElement | null>) {
  const [cols, setCols] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setCols(Math.max(1, getComputedStyle(el).gridTemplateColumns.split(" ").length));
    measure();
    // (a browser without ResizeObserver keeps the first count)
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}
function ShelfLabel({
  a,
  nav,
  settings,
  mini,
  row,
  col,
  span,
  open,
  onToggle,
}: {
  a: Asset;
  nav: bigint | undefined;
  settings: any;
  mini: boolean;
  row: number;
  col: number;
  span: number;
  open: boolean;
  onToggle: () => void;
}) {
  const value = assetValue(a),
    st = shelfStatus(a, settings),
    stale = staleFeed(a),
    chip = reasonChip(a, st.kind, settings),
    flags = shelfFlags(a),
    pct = nav && value ? Number((value * 10000n) / nav) / 100 : 0;
  const more = (
    <button
      type="button"
      className="sa-more"
      id={`sa-more-${a.token}`}
      aria-expanded={open}
      aria-controls={open ? "sa-drawer" : undefined}
      onClick={onToggle}
    >
      <span className={mini ? "sa-sr" : undefined}>Details</span>
      <span className="sa-sr"> for {a.symbol}</span>
      <span className="sa-chev" aria-hidden="true" />
    </button>
  );
  // the rubber stamp repeats the plain "Closed" words, so screen readers skip it
  const stamp = st.kind === "closed" && (
    <span className="sa-stamp" aria-hidden="true">
      Closed
    </span>
  );
  return (
    <li
      className="sa-slot"
      data-row={row}
      data-col={col}
      style={span > 1 ? { gridColumn: `span ${span}` } : undefined}
    >
      <article
        className={`sa-label sa-label--${st.kind} sa-label--${mini ? "mini" : "full"}${chip || flags.length ? " sa-label--chip" : ""}${open ? " is-open" : ""}`}
        aria-labelledby={`sa-t-${a.token}`}
      >
        <span className="sa-clip" aria-hidden="true" />
        {/* sa-main / sa-figs only group the lines for the two-column wide label */}
        <div className="sa-main">
          <div className="sa-top">
            <h4 id={`sa-t-${a.token}`}>
              <bdi>{a.symbol}</bdi>
            </h4>
            {stamp}
            <ShelfPrice a={a} stale={stale} />
            <OldPriceTag stale={stale} />
          </div>
          <p className="sa-st">
            <span className="sa-stw">
              <span className="sa-mark" aria-hidden="true" />
              {st.kind === "retired" ? (
                <b>Retired</b>
              ) : st.kind === "closed" ? (
                <b>
                  Closed<span className="sa-wide"> to deposits</span>
                </b>
              ) : (
                <b>Open</b>
              )}
              {st.kind === "paused" && (
                <>
                  {" · "}
                  <b className="sa-warn">not taking deposits</b>
                </>
              )}
            </span>
            {mini && more}
          </p>
          {chip && <p className="sa-chip">{chip}</p>}
          {flags.map((f) => (
            <p className="sa-flag" key={f}>
              {f}
            </p>
          ))}
        </div>
        {!mini && (
          <>
            <div className="sa-figs">
              <div className="sa-share">
                <b className={value === 0n ? "sa-pct is-zero" : "sa-pct"}>{shareText(value, nav)}</b>
                <span className="sa-meter">
                  <span className="sa-of">
                    <span className="sa-wide">of basket</span>
                    <span className="sa-narrow">share</span>
                  </span>
                  <span className="sa-bar" aria-hidden="true">
                    <i style={{ width: value ? `max(3px, ${Math.min(pct, 100)}%)` : 0 }} />
                  </span>
                </span>
              </div>
              <p className="sa-kv sa-kv--value">
                <span>Value</span> <b>{usd(value)}</b>
              </p>
              <p className="sa-kv">
                <span>Held</span>{" "}
                <b>
                  {fmt(a.managed, a.tokenDecimals)}
                  <span className="sa-wide">
                    {" "}
                    <bdi>{a.symbol}</bdi>
                  </span>
                </b>
              </p>
            </div>
            <div className="sa-foot">
              {more}
              <span className="sa-barcode" aria-hidden="true" />
            </div>
          </>
        )}
      </article>
    </li>
  );
}
function ShelfDrawer({
  a,
  nav,
  settings,
  at,
  cols,
  onClose,
}: {
  a: Asset;
  nav: bigint | undefined;
  settings: any;
  at: number;
  cols: number;
  onClose: () => void;
}) {
  const st = shelfStatus(a, settings),
    head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    head.current?.focus({ preventScroll: true });
    head.current?.scrollIntoView({ block: "nearest" });
  }, [a.token]);
  return (
    <li
      className="sa-drawer"
      id="sa-drawer"
      style={{ "--sa-at": at, "--sa-cols": cols } as CSSProperties}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="sa-drawer-top">
        <h5 ref={head} tabIndex={-1}>
          <bdi>{a.symbol}</bdi> details
        </h5>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {st.more && <p className="sa-drawer-status">{st.more}</p>}
      <dl>
        <div>
          <dt>Feed</dt>
          <dd className="chain-text">
            <bdi>{a.description}</bdi>
          </dd>
        </div>
        <div>
          <dt>Feed price</dt>
          <dd>
            {a.answer === undefined || a.answer <= 0n
              ? "unreadable / invalid feed"
              : "$" + fmt(a.answer, a.feedDecimals)}
          </dd>
        </div>
        <div>
          <dt>Pool check</dt>
          <dd>{poolCheck(a)}</dd>
        </div>
        <div>
          <dt>Held (managed)</dt>
          <dd>{fmt(a.managed, a.tokenDecimals)}</dd>
        </div>
        <div>
          <dt>Share of basket</dt>
          <dd>{shareText(assetValue(a), nav)}</dd>
        </div>
        <div>
          <dt>Owed</dt>
          <dd>{fmt(a.totalOwed, a.tokenDecimals)}</dd>
        </div>
      </dl>
      <dl className="sa-addrs">
        <div>
          <dt>Stock Token</dt>
          <dd>
            <AddressLink value={a.token} />
          </dd>
        </div>
        <div>
          <dt>Price feed</dt>
          <dd>
            <AddressLink value={a.feed} />
          </dd>
        </div>
      </dl>
    </li>
  );
}
// One group of shelves. Labels fill rows left to right; a double-width label
// that does not fit at the end of a row starts the next one. Empty slots keep
// the red shelf edge running, and the open drawer goes under its label's row.
function ShelfGroup({
  items,
  mini,
  nav,
  settings,
  rowBase,
  openToken,
  onToggle,
  onClose,
}: {
  items: Asset[];
  mini: boolean;
  nav: bigint | undefined;
  settings: any;
  rowBase: number;
  openToken: string | undefined;
  onToggle: (token: string) => void;
  onClose: (token: string) => void;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const cols = useGridCols(ref);
  const cells: ReactNode[] = [];
  let row = 0,
    col = 0,
    open: { a: Asset; row: number; at: number } | undefined;
  const endRow = () => {
    for (; col < cols; col++)
      cells.push(<li key={`e${row}-${col}`} className="sa-slot sa-slot--empty" aria-hidden="true" />);
    const o = open;
    if (o && o.row === row)
      cells.push(
        <ShelfDrawer
          key="drawer"
          a={o.a}
          nav={nav}
          settings={settings}
          at={o.at}
          cols={cols}
          onClose={() => onClose(o.a.token)}
        />,
      );
    row++;
    col = 0;
  };
  for (const a of items) {
    // double width; a compact one takes a whole row when a row holds 3 or fewer (phones)
    const span = !isWide(a, mini) ? 1 : mini && cols <= 3 ? cols : Math.min(2, cols);
    if (col + span > cols) endRow();
    cells.push(
      <ShelfLabel
        key={a.token}
        a={a}
        nav={nav}
        settings={settings}
        mini={mini}
        row={rowBase + row}
        col={col}
        span={span}
        open={openToken === a.token}
        onToggle={() => onToggle(a.token)}
      />,
    );
    if (openToken === a.token) open = { a, row, at: col + (span - 1) / 2 };
    col += span;
    if (col === cols) endRow();
  }
  if (col > 0) endRow();
  return (
    <ul ref={ref} role="list" className={`sa-shelves sa-shelves--${mini ? "mini" : "full"}`}>
      {cells}
    </ul>
  );
}
function ShelfSign({ name, count, children }: { name: string; count: number; children: ReactNode }) {
  return (
    <div className="sa-signrow">
      <h3 className="sa-sign">
        {name} <span className="sa-n">{count}</span>
      </h3>
      <p className="sa-sub">{children}</p>
    </div>
  );
}
function StockShelves({ snapshot: s }: { snapshot: Snapshot }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ShelfFilter>("all");
  const [openToken, setOpenToken] = useState<string>();
  const unit = useRef<HTMLDivElement>(null);
  const ready = s.assets.length > 0;
  const stopRestock = useRestock(unit, ready);
  const nav = navOf(s.assets, s.complete).nav;
  const q = search.trim().toLowerCase();
  const visible = s.assets.filter(
    (a) =>
      inShelfFilter(a, filter) &&
      (a.symbol.toLowerCase().includes(q) || a.token.toLowerCase().includes(q)),
  );
  // In the basket (held, or held amount unreadable): biggest share first
  // (unreadable values last, ties in listing order). On the shelf, not held
  // (held amount 0): listing order.
  const held = visible
    .filter((a) => a.managed !== 0n)
    .sort((x, y) => {
      const vx = assetValue(x) ?? -1n,
        vy = assetValue(y) ?? -1n;
      return vy > vx ? 1 : vy < vx ? -1 : x.index - y.index;
    });
  const rest = visible.filter((a) => a.managed === 0n).sort((x, y) => x.index - y.index);
  const emptyBasket = s.assets.every((a) => a.managed === 0n);
  // a new filter or search closes the drawer (it never comes back unasked)
  const show = (f: ShelfFilter, text: string) => {
    stopRestock();
    setOpenToken(undefined);
    setFilter(f);
    setSearch(text);
  };
  // a filter or a search (extra spaces ignored) is on: offer the way back to every
  // stock (when nothing matches, the "No stocks match" line has its own Show all)
  const narrowed = (filter !== "all" || q !== "") && visible.length > 0;
  const toggle = (token: string) => setOpenToken(openToken === token ? undefined : token);
  const close = (token: string) => {
    setOpenToken(undefined);
    requestAnimationFrame(() => document.getElementById(`sa-more-${token}`)?.focus());
  };
  const group = { nav, settings: s.globals.settings, openToken, onToggle: toggle, onClose: close };
  return (
    <section className="panel stock-section sa-section">
      <div className="section-heading">
        <h2>Stock shelves</h2>
        <span className="burst small">Fresh!</span>
      </div>
      {ready && (
        <>
          <div className="sa-toolbar">
            <div className="sa-filters" role="group" aria-label="Show stocks">
              {shelfFilters.map(([f, name]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => show(f, search)}
                >
                  {name}{" "}
                  <span className="sa-count">
                    {s.assets.filter((a) => inShelfFilter(a, f)).length}
                  </span>
                </button>
              ))}
            </div>
            <label className="sa-search">
              Search stocks
              <input
                type="search"
                value={search}
                placeholder="Ticker or address"
                onChange={(e) => show(filter, e.target.value)}
              />
            </label>
          </div>
          <p className="sa-note">
            <span role="status">
              Showing {visible.length} of {s.assets.length}
            </span>
            {narrowed && (
              <>
                {" · "}
                <button type="button" className="sa-reset" onClick={() => show("all", "")}>
                  Show all
                </button>
              </>
            )}
            {" · tap a label for its details"}
          </p>
        </>
      )}
      <div className="sa-unit" ref={unit}>
        <StoreShelf />
        {!ready ? (
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
        ) : !visible.length ? (
          <p className="sa-none">
            No stocks match{q ? ` "${search.trim()}"` : ""} here.{" "}
            <button type="button" onClick={() => show("all", "")}>
              Show all
            </button>
          </p>
        ) : (
          <>
            {emptyBasket ? (
              <ShelfSign name="In the basket" count={0}>
                <b className="sa-emptyline">
                  Nothing is in the basket yet.
                  {s.globals.genesisFinalized === false &&
                    " Deposits start after the owner finishes setup."}
                </b>
              </ShelfSign>
            ) : (
              held.length > 0 && (
                <>
                  <ShelfSign name="In the basket" count={held.length}>
                    biggest share first
                  </ShelfSign>
                  <ShelfGroup items={held} mini={false} rowBase={0} {...group} />
                </>
              )
            )}
            {rest.length > 0 && (
              <>
                <ShelfSign name="On the shelf, not held" count={rest.length}>
                  listing order
                </ShelfSign>
                <ShelfGroup items={rest} mini rowBase={100} {...group} />
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
