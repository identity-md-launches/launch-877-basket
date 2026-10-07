import { useEffect, useState, type FormEvent } from "react";
import type { Address } from "viem";
import {
  many,
  read,
  safe,
  simulate,
  vault,
  token,
  feed,
  explain,
  explainAction,
  proposalStateWords,
  InputError,
  zeroAddress,
  type Spec,
} from "./chain";
import {
  address,
  amount,
  parseLaunch,
  cleanFeedDescription,
  pairingMatches,
  loadSnapshot,
  usd,
  fmt,
  date,
  same,
  type Snapshot,
  type Asset,
} from "./model";
import {
  Addr,
  AddressLink,
  Empty,
  Note,
  PageTitle,
  RoleInfo,
  permitted,
  TxButton,
  type Role,
} from "./components";
import type { Wallet } from "./wallet";
type Props = { snapshot: Snapshot; wallet: Wallet };
type Field = {
  key: string;
  label: string;
  type?: "stock" | "amount" | "textarea";
  stocks?: Asset[];
  hint?: string;
};
function ActionForm({
  title,
  description,
  fields = [],
  label,
  build,
  confirmation,
  role = "owner",
  disabled = false,
  snapshot: s,
  wallet: w,
}: Props & {
  title: string;
  description?: string;
  fields?: Field[];
  label: string;
  build: (data: Record<string, string>) => Spec | Promise<Spec>;
  confirmation?: string;
  role?: Role;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const id = title.toLowerCase().replace(/[^a-z0-9]/g, "-");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setWorking(true);
    try {
      if (confirmation && !confirmed)
        throw new Error("Confirm the stated consequence before continuing.");
      await w.send(
        await build(
          Object.fromEntries(
            fields.map((f) => [
              f.key,
              values[f.key] ??
                (f.type === "stock" ? (f.stocks?.[0]?.token ?? "") : ""),
            ]),
          ),
        ),
      );
    } catch (err) {
      setError(explain(err));
      (e.target as HTMLFormElement)
        .querySelector<HTMLInputElement>("input, textarea, select")
        ?.focus();
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="panel action-panel">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      <form onSubmit={submit}>
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.type === "textarea" ? (
              <textarea
                rows={5}
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
                required
                aria-describedby={`${id}-error`}
              />
            ) : f.type === "stock" ? (
              <select
                value={values[f.key] ?? f.stocks?.[0]?.token ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
                required
                aria-describedby={`${id}-error`}
              >
                <option value="" disabled>
                  Choose a stock
                </option>
                {f.stocks?.map((a) => (
                  <option key={a.token} value={a.token}>
                    {a.symbol}
                    {a.retired ? " · retired" : !a.open ? " · closed" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={values[f.key] ?? ""}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
                inputMode={f.type === "amount" ? "decimal" : "text"}
                required
                aria-describedby={`${id}-error`}
                aria-invalid={!!error}
              />
            )}{" "}
            {f.hint && <small>{f.hint}</small>}
          </label>
        ))}
        {confirmation && (
          <label className="confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              required
            />
            {confirmation}
          </label>
        )}
        <RoleInfo role={role} snapshot={s} />
        <button
          type="submit"
          disabled={disabled || working || w.busy || !permitted(role, w, s)}
        >
          {working ? `${label}…` : label}
        </button>
        <p role="alert" className="error" id={`${id}-error`}>
          {error}
        </p>
      </form>
    </section>
  );
}
type Pairing = Pick<Asset, "token" | "feed" | "symbol" | "description" | "answer" | "feedReadable">;
export function Pairings({ assets }: { assets: Pairing[] }) {
  return assets.length ? (
    <div
      className="table-wrap"
      role="region"
      aria-label="Listed stock and feed pairings"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Stock Token</th>
            <th scope="col">Feed description</th>
            <th scope="col">Current price</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.token} className={pairingMatches(a.symbol, a.description) ? "" : "warning"}>
              <th scope="row">
                <bdi>{a.symbol}</bdi>
                <AddressLink value={a.token} />
              </th>
              <td>
                <span className="chain-text">
                  <bdi>{a.description}</bdi>
                </span>
                {!pairingMatches(a.symbol, a.description) && <strong className="pairing-warning">check this pairing</strong>}
                <AddressLink value={a.feed} />
              </td>
              <td>
                {a.feedReadable && a.answer !== undefined
                  ? "$" + fmt(a.answer, 8, 4)
                  : "unreadable"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p>No listed stock/feed pairs yet.</p>
  );
}
function LaunchListing({ snapshot: s, wallet: w }: Props) {
  const [lines, setLines] = useState("");
  const [table, setTable] = useState<{ input: string; rows: Pairing[]; error: string }>();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [listed, setListed] = useState<Asset[]>();
  const [mustReconcile, setMustReconcile] = useState(false);
  async function reconcile() {
    setChecking(true);
    setMustReconcile(true);
    try {
      const latest = await loadSnapshot();
      if (!latest.complete) throw new InputError("The listed stocks could not all be read. Retry the listing check before listing again.");
      setListed(latest.assets);
      setMustReconcile(false);
      setRevision(n => n + 1);
    } catch (e) { setError(explain(e)); }
    finally { setChecking(false); }
  }
  useEffect(() => {
    let active = true;
    setTable(undefined);
    if (!lines.trim()) { setChecking(false); return; }
    setChecking(true);
    (async () => {
      try {
        const parsed = parseLaunch(lines);
        const reads = await many(parsed.flatMap(r => [token(r.token, "symbol"), feed(r.feed, "description"), feed(r.feed, "latestRoundData"), vault("assetIndexPlusOne", [r.token])]));
        const issues: string[] = [];
        const rows = parsed.map((r, i) => {
          const [sym, desc, price, index] = reads.slice(i * 4, i * 4 + 4);
          const symbol = sym.ok ? String(sym.value) : "unreadable";
          const description = desc.ok ? cleanFeedDescription(String(desc.value), symbol) : "unreadable";
          if (![sym, desc, price, index].every(r => r.ok)) issues.push(`Line ${i + 1}: a chain read failed. Retry the pairing check.`);
          if (symbol !== r.ticker) issues.push(`Line ${i + 1}: pasted ticker does not match symbol().`);
          if (index.ok && index.value !== 0n) issues.push(`Line ${i + 1}: ${symbol} is already listed. Remove this line.`);
          if (!pairingMatches(symbol, description)) issues.push(`Line ${i + 1}: check this pairing.`);
          if (price.ok && price.value[1] <= 0n) issues.push(`Line ${i + 1}: price must be positive.`);
          const reused = s.assets.find(a => !a.retired && same(a.feed, r.feed));
          if (reused) issues.push(`Line ${i + 1}: feed already serves ${reused.symbol}.`);
          return { token: r.token, feed: r.feed, symbol, description, answer: price.ok ? price.value[1] as bigint : undefined, feedReadable: price.ok };
        });
        if (new Set(parsed.map(r => r.feed.toLowerCase())).size !== parsed.length) issues.push("A feed can serve only one unretired stock.");
        if (active) setTable({ input: lines, rows, error: issues.join(" ") });
      } catch (e) { if (active) setTable({ input: lines, rows: [], error: explain(e) }); }
      finally { if (active) setChecking(false); }
    })();
    return () => { active = false; };
  }, [lines, s.loadedAt, revision]);
  const blocked = checking || sending || mustReconcile || !table || table.input !== lines || !!table.error || !table.rows.length;
  return <section className="panel action-panel">
    <h3>List the launch basket</h3>
    <p>Paste one TICKER tokenAddress feedAddress per line. Check the chain-read pairings below before listing them together.</p>
    <form onSubmit={async e => {
      e.preventDefault();
      if (blocked || !table) return;
      const rows = table.rows;
      setSending(true); setError("");
      try {
        const indexes = await many(rows.map(r => vault("assetIndexPlusOne", [r.token])));
        if (indexes.some(r => !r.ok || r.value !== 0n)) throw new InputError("A stock is already listed or unreadable. Check the refreshed listed stocks below.");
        await w.send(vault("proposeAssets", [rows.map(r => r.token), rows.map(r => r.feed)]));
      } catch (e) { setError(explain(e)); }
      finally { await reconcile(); setSending(false); }
    }}>
      <label>Stock Token and feed pairs<textarea rows={5} value={lines} disabled={sending || w.busy} onChange={e => { setLines(e.target.value); setError(""); }} aria-describedby="listing-error" aria-invalid={!!table?.error} placeholder="TICKER 0x…token 0x…feed" /></label>
      {checking && <p role="status">Reading stock and feed pairings…</p>}
      {table && table.input === lines && <Pairings assets={table.rows} />}
      <p className="error" role="alert" id="listing-error">{table?.input === lines ? table.error : ""} {error}</p>
      <RoleInfo role="owner" snapshot={s} />
      <div className="button-row">
        <button type="submit" disabled={blocked || w.busy || !permitted("owner", w, s) || s.globals.genesisFinalized !== false}>{sending ? "Listing stocks…" : "List all stocks"}</button>
        <button type="button" disabled={checking || sending} onClick={() => { if (mustReconcile) void reconcile(); else setRevision(n => n + 1); }}>Retry pairing check</button>
      </div>
    </form>
    {listed && <div className="receipt"><h3>Listed now · read from the vault</h3><Pairings assets={listed} /></div>}
  </section>;
}
export function OwnerPage({ snapshot: s, wallet: w }: Props) {
  const live = s.assets.filter((a) => !a.retired);
  const closed = live.filter((a) => !a.open);
  const stock = (stocks = live): Field => ({
    key: "stock",
    label: "Stock Token",
    type: "stock",
    stocks,
  });
  const feedField: Field = { key: "feed", label: "New feed address" };
  const props = { snapshot: s, wallet: w };
  return (
    <>
      <PageTitle eyebrow="Public control room" title="Owner">
        All controls and proposals are visible to everyone. Only the wallet
        allowed by the vault can send each transaction.
      </PageTitle>
      <div className="roles panel">
        <div>
          <strong>Owner</strong>
          <Addr value={s.globals.owner} />
        </div>
        <div>
          <strong>Guardian</strong>
          <Addr value={s.globals.guardian} />
        </div>
        <div>
          <strong>Pending owner</strong>
          {s.globals.pendingOwner === zeroAddress ? (
            <span>None</span>
          ) : (
            <Addr value={s.globals.pendingOwner} />
          )}
        </div>
      </div>
      <section className="owner-section">
        <div className="section-heading">
          <h2>
            <span className="step">01</span> Launch
          </h2>
          <span className="badge">
            {s.globals.genesisFinalized === undefined
              ? "unreadable"
              : s.globals.genesisFinalized
                ? "Genesis finalized"
                : "Genesis not finalized"}
          </span>
        </div>
        <div className="launch-steps">
          <LaunchListing {...props} />
          <section className="panel">
            <h3>Check the shelf labels</h3>
            <p>
              Verify the stock symbol, feed description and price belong together.
              Feed labels omit the issuer prefix. A feed can serve only one unretired stock; a retired stock’s feed can be reused.
            </p>
            <Pairings assets={s.assets} />
          </section>
          <ActionForm
            {...props}
            title="Finalize genesis"
            label="Finalize genesis"
            description="List at least three Stock Tokens and check every feed pairing before finalizing."
            disabled={s.globals.genesisFinalized !== false}
            confirmation="I understand this cannot be undone, listed stocks can never be removed, and deposits open 72 hours later."
            build={() => vault("finalizeGenesis")}
          />
        </div>
      </section>
      <section className="owner-section">
        <h2>
          <span className="step">02</span> Propose a change
        </h2>
        <p>
          After genesis, proposals wait seven days and expire fourteen days
          after creation. Stock listings and feed replacements share a 24-hour
          execution cooldown.
        </p>
        <div className="two-col">
          <ActionForm
            {...props}
            title="New stock"
            label="Propose stock"
            fields={[{ key: "token", label: "Stock Token address" }, feedField]}
            disabled={!s.globals.genesisFinalized}
            build={async (v) => {
              const t = address(v.token);
              if (await read(vault("assetIndexPlusOne", [t])) !== 0n) throw new InputError("This stock is already listed. Choose an unlisted stock.");
              return vault("proposeAsset", [t, address(v.feed)]);
            }}
          />
          <ActionForm
            {...props}
            title="Replacement feed"
            label="Propose feed"
            fields={[stock(), feedField]}
            build={(v) =>
              vault("proposeFeed", [address(v.stock), address(v.feed)])
            }
          />
          <ActionForm
            {...props}
            title="Re-centre a price band"
            label="Propose band re-centre"
            description="The new band will use the current feed answer at execution."
            fields={[stock()]}
            build={(v) => vault("proposeBand", [address(v.stock)])}
          />
          <ActionForm
            {...props}
            title="Reopen a stock"
            label="Propose reopening"
            fields={[stock(closed)]}
            build={(v) => vault("proposeReopen", [address(v.stock)])}
          />
          <ActionForm
            {...props}
            title="Retire a closed stock"
            label="Propose retirement"
            fields={[stock(closed)]}
            confirmation="I understand retirement cannot be undone. The stock is closed for good and counts 0 for new deposits, while redemption still pays it out. New depositors take a share of its value from current holders."
            build={(v) => vault("proposeRetire", [address(v.stock)])}
          />
          <ActionForm
            {...props}
            title="New guardian"
            label="Propose guardian"
            fields={[{ key: "next", label: "New guardian address" }]}
            build={(v) => vault("proposeGuardian", [address(v.next)])}
          />
          <ActionForm
            {...props}
            title="Raise the NAV cap"
            label="Propose higher NAV cap"
            description={`Current cap: ${usd(s.globals.NAV_CAP)}. Enter dollars; the transaction uses dollars × 10¹⁸.`}
            fields={[
              { key: "cap", label: "New NAV cap (USD)", type: "amount" },
            ]}
            build={(v) => vault("proposeNavCap", [amount(v.cap)])}
          />
        </div>
      </section>
      <Proposals {...props} />
      <section className="owner-section">
        <h2>
          <span className="step">03</span> Immediate controls
        </h2>
        <div className="two-col">
          <ActionForm
            {...props}
            title="Close a stock"
            label="Close stock"
            role="operator"
            description="Stops deposits of this stock and voids earlier reopening proposals."
            fields={[stock(s.assets)]}
            build={(v) => vault("closeAsset", [address(v.stock)])}
          />
          <section className="panel">
            <h3>Deposit pause</h3>
            <p>
              Current state:{" "}
              {s.globals.depositsPaused === undefined
                ? "unreadable"
                : s.globals.depositsPaused
                  ? "Paused"
                  : "Not paused"}
            </p>
            <RoleInfo role="operator" snapshot={s} />
            <TxButton
              {...props}
              label="Pause deposits"
              role="operator"
              getSpec={() => vault("pauseDeposits")}
            />
            <RoleInfo role="owner" snapshot={s} />
            <TxButton
              {...props}
              label="Unpause deposits"
              role="owner"
              getSpec={() => vault("unpauseDeposits")}
            />
          </section>
          <ActionForm
            {...props}
            title="Lower the NAV cap"
            label="Lower NAV cap"
            description="This also voids every pending NAV-cap raise. Enter dollars; the transaction uses dollars × 10¹⁸. Zero is allowed."
            fields={[
              { key: "cap", label: "Lower NAV cap (USD)", type: "amount" },
            ]}
            build={(v) => vault("lowerNavCap", [amount(v.cap, true)])}
          />
          <ActionForm
            {...props}
            title="Set the fee recipient"
            label="Set fee recipient"
            description={
              s.globals.feeRecipient === zeroAddress
                ? "The fee recipient has not been set."
                : `Current fee recipient: ${s.globals.feeRecipient ?? "unreadable"}`
            }
            fields={[{ key: "recipient", label: "Fee recipient address" }]}
            disabled={s.globals.feeRecipient !== zeroAddress}
            confirmation="I understand this is final. The fee recipient can be set only once and can never be changed."
            build={(v) => vault("setFeeRecipient", [address(v.recipient)])}
          />
          <ActionForm
            {...props}
            title="Transfer ownership"
            label="Start ownership transfer"
            description="The new owner must accept from their own wallet. The new owner must not be the guardian."
            fields={[{ key: "next", label: "New owner address" }]}
            build={(v) => {
              const next = address(v.next);
              if (same(next, s.globals.guardian))
                throw new Error("The new owner must not be the guardian.");
              return vault("transferOwnership", [next]);
            }}
          />
          <ActionForm
            {...props}
            title="Accept ownership"
            label="Accept ownership"
            role="pending"
            description="The new owner must not be the guardian. Check the current guardian before accepting."
            build={() => {
              if (same(w.account, s.globals.guardian))
                throw new Error("The new owner must not be the guardian.");
              return vault("acceptOwnership");
            }}
          />
        </div>
      </section>
    </>
  );
}
const kinds = [
  "List new stock",
  "Replace feed",
  "Re-centre band",
  "Reopen stock",
  "Retire stock",
  "Replace guardian",
  "Raise NAV cap",
];
type Proposal = {
  id: bigint;
  kind: number;
  token: Address;
  target: Address;
  value: bigint;
  createdAt: bigint;
  epoch: bigint;
  cancelled: boolean;
  executed: boolean;
  state: number;
  symbol: string;
  description?: string;
  price?: bigint;
  simulation?: string;
  executable: boolean;
};
function Proposals({ snapshot: s, wallet: w }: Props) {
  const [start, setStart] = useState(1n);
  const [rows, setRows] = useState<Proposal[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setRows([]);
    setError("");
    (async () => {
      try {
        const ids: bigint[] = await read(vault("pendingProposals", [start, 20n]));
        const result = await Promise.all(
          ids.map(async (id) => {
            const [detail, state] = await Promise.all([read(vault("proposals", [id])), read(vault("proposalState", [id]))]);
            const [kind, tokenAddress, target, value, createdAt, epoch, cancelled, executed] = detail;
            const p = { kind: Number(kind), token: tokenAddress as Address, target: target as Address, value, createdAt, epoch, cancelled, executed };
            const row: Proposal = { ...p, state: Number(state), id, symbol: "unreadable", executable: false };
            if (p.token !== zeroAddress) {
              const sym = await safe(token(p.token, "symbol"));
              row.symbol = sym.ok ? sym.value : "unreadable";
            }
            if (p.kind === 0 || p.kind === 1) {
              const meta = await many([
                feed(p.target, "description"),
                feed(p.target, "latestRoundData"),
              ]);
              row.description = meta[0].ok ? cleanFeedDescription(meta[0].value, row.symbol) : "unreadable";
              row.price = meta[1].ok ? meta[1].value[1] : undefined;
            }
            try {
              await simulate(vault("executeProposal", [id]), w.account);
              row.executable = true;
            } catch (e) {
              row.simulation = await explainAction(e, vault("executeProposal", [id]));
            }
            return row;
          }),
        );
        if (active) setRows(result);
      } catch {
        if (active) setError("Pending proposals: unreadable. Retry this page.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [start, s.loadedAt, w.account, retry]);
  return (
    <section className="owner-section">
      <div className="section-heading">
        <h2>Pending proposals</h2>
        <button onClick={() => setRetry((x) => x + 1)} disabled={loading}>
          Refresh proposals
        </button>
      </div>
      <p className="muted">
        Scanning proposal IDs {String(start)}–{String(start + 19n)}. Empty pages
        can occur between pending proposals.
      </p>
      {loading && (
        <p role="status">Reading proposals and simulating execution…</p>
      )}
      <p className="error" role="alert">
        {error}
      </p>
      {!loading && !error && !rows.length && (
        <Empty title="No pending proposals on this page">
          Check the next page if more proposal IDs exist.
        </Empty>
      )}
      <div className="two-col">
        {rows.map((p) => (
          <article className="panel" key={String(p.id)}>
            <p className="eyebrow">Proposal #{String(p.id)}</p>
            <h3>{kinds[p.kind]}</h3>
            {p.token !== zeroAddress && (
              <>
                <p>
                  Stock: <bdi>{p.symbol}</bdi>
                </p>
                <AddressLink value={p.token} />
              </>
            )}
            {(p.kind === 0 || p.kind === 1) && (
              <div className={pairingMatches(p.symbol, p.description ?? "") ? "receipt" : "receipt warning"}>
                {!pairingMatches(p.symbol, p.description ?? "") && <p><strong>check this pairing</strong></p>}
                <dl>
                  <div>
                    <dt>Stock symbol</dt>
                    <dd>
                      <bdi>{p.symbol}</bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>New feed description</dt>
                    <dd className="chain-text">
                      <bdi>{p.description}</bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>Current price</dt>
                    <dd>
                      {p.price === undefined
                        ? "unreadable"
                        : "$" + fmt(p.price, 8, 4)}
                    </dd>
                  </div>
                </dl>
                <AddressLink value={p.target} />
              </div>
            )}
            {p.kind === 5 && (
              <p>
                New guardian: <Addr value={p.target} />
              </p>
            )}
            {p.kind === 6 && <p>New cap: {usd(p.value)}</p>}
            {p.kind === 2 && <p>Re-centres on the feed answer at execution.</p>}
            {p.kind === 4 && (
              <Note warning>
                Permanent retirement: closed for good, 0 in deposit NAV, still
                paid on redemption. New depositors take a share of its value
                from current holders.
              </Note>
            )}
            <p>
              Executable from {date(p.createdAt + 7n * 86400n)}
              <br />
              Expires {date(p.createdAt + 14n * 86400n)}
            </p>
            <p>State: {proposalStateWords(p.state, p.createdAt)}</p>
            {[0, 1, 2, 4].includes(p.kind) && <Note warning>Pause deposits before this can be executed and keep them paused until it is executed and checked.</Note>}
            <RoleInfo role="anyone" snapshot={s} />
            {p.executable ? (
              <TxButton
                snapshot={s}
                wallet={w}
                label="Execute"
                getSpec={() => vault("executeProposal", [p.id])}
              />
            ) : (
              <Note>Execution unavailable: {p.simulation ?? "unreadable"}</Note>
            )}
            <RoleInfo role={p.kind === 5 ? "owner" : "operator"} snapshot={s} />
            <TxButton
              snapshot={s}
              wallet={w}
              role={p.kind === 5 ? "owner" : "operator"}
              label="Cancel proposal"
              getSpec={() => vault("cancelProposal", [p.id])}
            />
          </article>
        ))}
      </div>
      <div className="button-row">
        <button
          disabled={start === 1n || loading}
          onClick={() => setStart((n) => n - 20n)}
        >
          Previous proposal page
        </button>
        <button
          disabled={
            loading ||
            (s.globals.proposalCount !== undefined &&
              start + 20n > s.globals.proposalCount)
          }
          onClick={() => setStart((n) => n + 20n)}
        >
          Next proposal page
        </button>
      </div>
    </section>
  );
}
