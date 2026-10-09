import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Address } from "viem";
import {
  read,
  many,
  vault,
  simulate,
  explain,
  InputError,
  zeroAddress,
  reasonWords,
  minutesOf,
  type Spec,
} from "./chain";
import {
  address,
  recipient,
  amount,
  parseLaunch,
  loadSnapshot,
  same,
  fmt,
  date,
  usd,
  type Snapshot,
  type Asset,
} from "./model";
import {
  Addr,
  AddressLink,
  Note,
  PageTitle,
  RoleInfo,
  permitted,
  TxButton,
  type Role,
  ActionStatus,
  DisabledReason,
  actionReason,
} from "./components";
import {
  inspectListing,
  proposalSpec,
  proposalWords,
  proposalKinds,
  settingNames,
  settingFields,
  settingBoundsWords,
  gasMaximum,
  settingWords,
  settingValues,
  newOwner,
  type Pairing,
} from "./governance";
import { dstWords, hoursWordsOf, zoneWords } from "./newYork";
import { TransactionCancelled, type Wallet } from "./wallet";
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
  disabledReason = "Data missing. Complete setup or retry the vault.",
  folded = true,
  preview,
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
  disabledReason?: string;
  folded?: boolean;
  preview?: (values: Record<string, string>) => string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const lock = useRef(false);
  const missingStock = fields.some(
    (f) =>
      f.type === "stock" &&
      !f.stocks?.some((a) => same(a.token, values[f.key])),
  );
  const missingField = fields.some((f) => !(values[f.key] || "").trim());
  const reason =
    actionReason(w, s, role) ||
    (working
      ? "Checking... Wait for this action."
      : missingStock
        ? "Choose a stock. If your previous stock disappeared, choose again."
        : missingField
          ? "Complete the fields above."
          : confirmation && !confirmed
            ? "Read and confirm the consequence above."
            : disabled
              ? disabledReason
              : "");
  useEffect(() => {
    if (s.loading) return;
    setValues((old) => {
      const next = { ...old };
      let changed = false;
      fields
        .filter((f) => f.type === "stock")
        .forEach((f) => {
          if (
            next[f.key] &&
            !f.stocks?.some((a) => same(a.token, next[f.key]))
          ) {
            next[f.key] = "";
            changed = true;
          }
        });
      return changed ? next : old;
    });
  }, [s.loadedAt]);
  const id = title.toLowerCase().replace(/[^a-z0-9]/g, "-");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || reason) return;
    lock.current = true;
    setError("");
    setWorking(true);
    try {
      if (confirmation && !confirmed)
        throw new Error("Confirm the stated consequence before continuing.");
      await w.send(
        await build(
          Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ""])),
        ),
        title,
        label,
      );
    } catch (err) {
      setError(explain(err));
      w.fail(title, explain(err));
      (e.target as HTMLFormElement)
        .querySelector<HTMLInputElement>("input, textarea, select")
        ?.focus();
    } finally {
      setWorking(false);
      lock.current = false;
    }
  }
  return (
    <details className="panel action-panel" open={folded ? undefined : true}>
      <summary>{title}</summary>
      {description && <p>{description}</p>}
      <form onSubmit={submit}>
        {fields.map((f) => (
          <label key={f.key}>
            {f.label}
            {f.type === "textarea" ? (
              <textarea
                disabled={working || w.busy}
                aria-label={f.label}
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
                disabled={working || w.busy}
                aria-label={f.label}
                value={
                  f.stocks?.some((a) => same(a.token, values[f.key]))
                    ? values[f.key]
                    : ""
                }
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
                disabled={working || w.busy}
                aria-label={f.label}
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
            {f.type === "stock" &&
              f.stocks?.some((a) => same(a.token, values[f.key])) && (
                <span className="chosen-stock">
                  Chosen:{" "}
                  {f.stocks.find((a) => same(a.token, values[f.key]))?.symbol}
                  <Addr value={values[f.key]} />
                </span>
              )}
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
        {preview && <p className="setting-preview">{preview(values)}</p>}
        <RoleInfo role={role} snapshot={s} />
        <button type="submit" disabled={!!reason}>
          {working ? `${label}…` : label}
        </button>
        <DisabledReason reason={reason} wallet={w} snapshot={s} />
        <ActionStatus wallet={w} scope={title} />
        <p role="alert" className="error" id={`${id}-error`}>
          {error}
        </p>
      </form>
    </details>
  );
}
function PairingRows({ rows }: { rows: Pairing[] }) {
  return (
    <div className="pairing-grid">
      {rows.map((r, i) => (
        <article className="receipt" key={r.token}>
          <h3>
            Row {i + 1}: <bdi>{r.symbol}</bdi>
          </h3>
          <p>Input line {r.line}</p>
          <AddressLink value={r.token} />
          <p>
            Stock feed: <bdi>{r.description}</bdi>
          </p>
          <AddressLink value={r.feed} />
          {r.marked && (
            <strong className="pairing-warning">check this pairing</strong>
          )}
          <p>
            Feed price:{" "}
            {r.price === undefined
              ? "unreadable"
              : "$" + fmt(r.price, r.feedDecimals)}
          </p>
          <p>
            Pool: <Addr value={r.pool} />
            Pool tokens: <bdi>{r.poolSymbols}</bdi>
          </p>
          <p>
            Quote feed: <bdi>{r.quoteName}</bdi>
            <Addr value={r.quoteFeed} />
          </p>
          <p>minLiquidity: {String(r.minLiquidity)}</p>
          {!same(r.pool, zeroAddress) && (
            <>
              <p>
                Current{" "}
                {r.poolWindow === undefined
                  ? "pool-window"
                  : minutesOf(r.poolWindow)}{" "}
                liquidity:{" "}
                {r.liquidity === undefined ? "unreadable" : String(r.liquidity)}{" "}
                ·{" "}
                {r.liquidity === undefined
                  ? "unreadable"
                  : r.minLiquidity === 0n
                    ? "No minimum (0)"
                    : fmt((r.liquidity * 10000n) / r.minLiquidity, 4, 4) +
                      "× minLiquidity"}
              </p>
              <p>
                Pool-vs-feed gap:{" "}
                {r.gapBps === undefined
                  ? "unreadable"
                  : fmt(r.gapBps, 2, 2) + "%"}
              </p>
            </>
          )}
          <strong>
            {r.error || r.marked
              ? "Needs correction"
              : r.listed
                ? "Already listed; matches this line"
                : "Ready to list"}
          </strong>
          {r.warning && <p className="note warning">{r.warning}</p>}
          {r.error && <p className="error">{r.error}</p>}
        </article>
      ))}
    </div>
  );
}
function LaunchListing({
  snapshot: s,
  wallet: w,
  input,
  setInput,
}: Props & { input: string; setInput: (v: string) => void }) {
  const [rows, setRows] = useState<Pairing[]>([]),
    [checked, setChecked] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [working, setWorking] = useState(false),
    [resume, setResume] = useState(false),
    [pending, setPending] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    if (w.account && same(w.account, s.globals.owner))
      w.listingPending()
        .then((finished) => {
          if (!live) return;
          setPending("");
          // The saved transaction is mined or replaced: its timeout text is stale.
          if (finished) {
            setError("");
            setResume(true);
          }
        })
        .catch((e) => {
          if (live) setPending(explain(e));
        });
    return () => {
      live = false;
    };
  }, [w.account, s.loadedAt]);
  async function checkRows() {
    setChecked("");
    setError("");
    const parsed = parseLaunch(input),
      results: Pairing[] = [];
    const current = await loadSnapshot();
    if (!current.complete)
      throw new InputError(
        "Listed stocks unreadable. Retry vault before checking.",
      );
    for (let i = 0; i < parsed.length; i++) {
      setProgress(`Checking row ${i + 1} of ${parsed.length}`);
      let r: Pairing;
      try {
        r = await inspectListing(parsed[i]);
        if (
          !r.listed &&
          current.assets.some((a) => !a.retired && same(a.feed, r.feed))
        )
          r.error = "Stock feed already used by an unretired stock.";
        if (!r.listed && !r.error && !r.marked)
          await simulate(
            vault("listGenesis", [
              r.token,
              r.feed,
              r.pool,
              r.quoteFeed,
              r.minLiquidity,
            ]),
            s.globals.owner,
          );
      } catch (e) {
        r = {
          ...parsed[i],
          symbol: parsed[i].ticker,
          description: "unreadable",
          price: undefined,
          feedDecimals: 0,
          poolSymbols: "unreadable",
          quoteName: "unreadable",
          listed: false,
          marked: false,
          error: `Row ${i + 1}, line ${parsed[i].line} (${parsed[i].ticker}): ${explain(e)}`,
        };
      }
      results.push(r);
      setRows([...results]);
    }
    setChecked(input);
    setProgress(
      results.some((r) => r.error || r.marked)
        ? "Checks finished. Rows marked Needs correction cannot be listed."
        : "Checks finished. Pairings ready.",
    );
    return results;
  }
  async function check() {
    if (lock.current) return;
    lock.current = true;
    setWorking(true);
    try {
      await checkRows();
    } catch (e) {
      setError(explain(e));
    } finally {
      setWorking(false);
      lock.current = false;
    }
  }
  const reason =
    actionReason(w, s, "owner") ||
    (working
      ? "Checking or listing. Wait for the current row."
      : pending ||
        (checked !== input && !resume
          ? "Check pairings before listing."
          : !input.trim()
            ? "Paste the stock rows above."
            : rows.some((r) => r.marked || r.error)
              ? "Needs correction. Fix the marked rows, then check pairings again."
              : ""));
  return (
    <section className="panel">
      <h3>List initial stocks</h3>
      <p>
        Paste one line per stock: TICKER token feed pool quoteFeed minLiquidity.
        For no pool, enter zero addresses for pool and quoteFeed, and 0 for
        minLiquidity.
      </p>
      <label>
        Listing rows
        <textarea
          rows={5}
          value={input}
          disabled={working || w.busy}
          onChange={(e) => {
            setInput(e.target.value);
            setChecked("");
            setRows([]);
            setResume(false);
          }}
          spellCheck={false}
        />
      </label>
      <button
        onClick={check}
        disabled={working || s.loading || s.globals.genesisFinalized !== false}
      >
        Check pairings / Retry
      </button>
      {(working || s.loading || s.globals.genesisFinalized !== false) && (
        <p className="disabled-reason">
          {working || s.loading
            ? "Reading... Wait for the check."
            : "Genesis must be readable and not finalized. Retry vault."}
        </p>
      )}
      <p role="status">{progress}</p>
      <PairingRows rows={rows} />
      <RoleInfo role="owner" snapshot={s} />
      <button
        disabled={!!reason}
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setWorking(true);
          setError("");
          let rowName = "Listing",
            rowNumber = 0;
          try {
            await w.listingPending();
            const checkedRows = await checkRows();
            if (checkedRows.some((r) => r.marked || r.error))
              throw new InputError(
                "Needs correction. Fix the marked rows before resuming.",
              );
            for (let i = 0; i < checkedRows.length; i++) {
              const r = checkedRows[i];
              rowNumber = i + 1;
              rowName = `Row ${i + 1} of ${checkedRows.length}: ${r.symbol}`;
              setProgress(rowName);
              await w.listingPending();
              const fresh = await inspectListing(r);
              if (fresh.marked || fresh.error)
                throw new InputError(fresh.error || "check this pairing");
              if (fresh.listed) continue;
              await w.send(
                vault("listGenesis", [
                  r.token,
                  r.feed,
                  r.pool,
                  r.quoteFeed,
                  r.minLiquidity,
                ]),
                "listing",
                rowName,
              );
              const after = await inspectListing(r);
              // A receipt but no listing: the wallet cancelled or replaced it.
              if (!after.listed)
                throw new TransactionCancelled("Not listed after the receipt.");
              if (after.error) throw new InputError(after.error);
              setRows((old) =>
                old.map((x) => (same(x.token, r.token) ? after : x)),
              );
            }
            setProgress("All rows listed and matched against chain.");
            setResume(false);
          } catch (e) {
            if (e instanceof TransactionCancelled) {
              // Never "Confirmed": say it in the listing status and the top bar too.
              const text = `Row ${rowNumber}: the transaction was cancelled in the wallet; nothing was listed. Press Resume listing.`;
              setError(text);
              w.notice("listing", text);
            } else setError(`${rowName}: ${explain(e)}`);
            setResume(true);
            try {
              await w.listingPending();
            } catch (e) {
              setPending(explain(e));
            }
          } finally {
            setWorking(false);
            lock.current = false;
          }
        }}
      >
        {resume ? "Resume listing" : "List stocks"}
      </button>
      <DisabledReason reason={reason} wallet={w} snapshot={s} />
      {pending && (
        <button
          disabled={working || w.busy}
          onClick={async () => {
            setWorking(true);
            try {
              await w.waitPending();
              setPending("");
              setError("");
              setResume(true);
            } catch (e) {
              setPending(explain(e));
            } finally {
              setWorking(false);
            }
          }}
        >
          Wait for pending transaction / Retry
        </button>
      )}
      <ActionStatus wallet={w} scope="listing" />
      <p role="alert" className="error">
        {error}
      </p>
    </section>
  );
}
function SettingForm(props: Props) {
  const [key, setKey] = useState(0);
  const current = props.snapshot.globals.settings;
  const currentWords = !current
    ? "unreadable — Retry vault"
    : key === 5
      ? `${hoursWordsOf(BigInt(current.hoursFrom), BigInt(current.hoursTo), BigInt(current.dst))}; ${current.hoursFrom}-${current.hoursTo}`
      : key === 6
        ? `${dstWords[Number(current.dst)] ?? "unknown"}; ${current.dst}`
        : `${current[settingFields[key]]}; ${settingWords(key, BigInt(current[settingFields[key]]), 0n, current)}`;
  const fixedZone =
    current && BigInt(current.dst) !== 0n ? BigInt(current.dst) : undefined;
  return (
    <div className="panel setting-panel">
      <h3>Setting</h3>
      <label>
        Setting name
        <select
          aria-label="Setting name"
          value={key}
          onChange={(e) => setKey(Number(e.target.value))}
        >
          {settingNames.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <p>
        Current {settingFields[key]}:{" "}
        {props.snapshot.loading ? "Reading..." : currentWords}
      </p>
      <p>Bounds: {settingBoundsWords(key, current)}</p>
      {key === 5 && (
        <p>
          Hours are seconds since Sunday 00:00 New York time. Enter From and To
          as a weekday and New York time, e.g. "Monday 9:30 am" and "Friday
          4:00 pm" (To may be "Saturday 24:00"), or "Always open" in both. The
          start is inclusive and the end exclusive.
          {fixedZone !== undefined &&
            ` With the current Dst ${fixedZone}, the vault reads these times as ${zoneWords(fixedZone)} all year, not New York time.`}
        </p>
      )}
      {key === 6 && (
        <p>
          0 follows the US daylight saving rule; 1 never applies daylight
          saving (UTC-5); 2 always applies it (UTC-4).
        </p>
      )}
      {(key === 3 || key === 4) && (
        <p>
          Deposits need at least FreshCount listed stock prices updated within
          the last FreshHours hours, so they close when prices stop (US market
          holidays) until one updates. FreshCount 0 turns this off.
        </p>
      )}
      <ActionForm
        key={key}
        {...props}
        title={`Set ${settingNames[key]}`}
        label="Propose setting"
        fields={
          key === 5
            ? [
                {
                  key: "from",
                  label: "From (weekday and New York time, or Always open)",
                },
                {
                  key: "to",
                  label: "To (weekday and New York time; Saturday 24:00 allowed)",
                },
              ]
            : [
                {
                  key: "value",
                  label: `New ${settingFields[key]} value`,
                  type: "amount",
                },
              ]
        }
        preview={(v) => {
          try {
            const [, value, value2] = settingValues(
              {
                ...v,
                setting: String(key),
              },
              current,
            );
            const max = gasMaximum(key, current);
            return key === 5
              ? `Proposed value ${value}, value2 ${value2}; ${settingWords(key, value, value2, current)}`
              : `Proposed raw value: ${value}; ${settingWords(key, value, 0n, current)}` +
                  (max !== undefined && value > max
                    ? `. Over the current maximum ${max}: the vault would refuse it.`
                    : "");
          } catch (e) {
            return e instanceof InputError
              ? e.message
              : "Enter a proposed value to see its plain units.";
          }
        }}
        build={(v) =>
          proposalSpec(10, { ...v, setting: String(key) }, current)
        }
      />
    </div>
  );
}
function Proposals({ snapshot: s, wallet: w }: Props) {
  const [start, setStart] = useState(1n),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setRows([]);
    setError("");
    read(vault("pendingProposals", [start, start + 49n]))
      .then(async (ids: bigint[]) => {
        // proposal(id) -> [data, pending]; data.action is the BaskVault.Action.
        const items = await many(ids.map((id) => vault("proposal", [id])));
        if (items.some((r) => !r.ok)) throw new Error("proposal unreadable");
        if (live)
          setRows(
            items.map((r, i) => ({
              ...(r as { ok: true; value: any }).value[0],
              id: ids[i],
            })),
          );
      })
      .catch(() => {
        if (live) setError("Pending proposals unreadable. Retry proposals.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [start, s.loadedAt, retry]);
  return (
    <section className="owner-section panel" id="owner-pending" tabIndex={-1}>
      <div className="section-heading">
        <h2>Pending proposals</h2>
        <button onClick={() => setRetry((x) => x + 1)} disabled={loading}>
          {loading
            ? "Reading..."
            : error
              ? "Retry proposals"
              : "Refresh proposals"}
        </button>
      </div>
      <p>
        Scanning IDs {String(start)}–{String(start + 49n)} of{" "}
        {s.globals.proposalCount === undefined
          ? "unreadable"
          : String(s.globals.proposalCount)}
        . Empty ranges may occur.
      </p>
      <p role="alert" className="error">
        {error}
      </p>
      {loading ? (
        <p role="status">Reading proposals…</p>
      ) : !error && !rows.length ? (
        <p>No pending proposals in this range.</p>
      ) : null}
      <div className="two-col">
        {rows.map((p) => {
          // Executable from createdAt + 2 days until createdAt + 9 days (exclusive).
          const now = BigInt(Math.floor(Date.now() / 1000)),
            readyAt = p.createdAt + 2n * 86400n,
            expiresAt = p.createdAt + 9n * 86400n,
            ready = now >= readyAt,
            expired = now >= expiresAt,
            kind = Number(p.action.kind),
            token = p.action.token as Address,
            paused = [4, 6].includes(kind);
          return (
            <article className="receipt" key={String(p.id)}>
              <h3>
                {proposalKinds[kind]} · Proposal {String(p.id)}
              </h3>
              <p>
                Stock:{" "}
                {same(token, zeroAddress)
                  ? "Global setting"
                  : (s.assets.find((a) => same(a.token, token))?.symbol ??
                    "unlisted / symbol unreadable")}
              </p>
              {!same(token, zeroAddress) && <Addr value={token} />}
              <p className="chain-text">
                {proposalWords(p.action, s.globals.settings)}
              </p>
              <p>
                {ready
                  ? `ready until just before ${date(expiresAt, "end")}`
                  : `waiting, executable from ${date(readyAt)}`}
              </p>
              {paused && (
                <Note warning>Keep deposits paused for execution.</Note>
              )}
              <TxButton
                snapshot={s}
                wallet={w}
                role="owner"
                label="Execute"
                scope={`Execute proposal ${p.id}`}
                disabled={
                  !ready ||
                  expired ||
                  (paused && s.globals.depositsPaused !== true)
                }
                disabledReason={
                  expired
                    ? "Proposal expired. Propose the change again."
                    : !ready
                      ? `Wait until ${date(readyAt)}.`
                      : "Pause deposits before executing this proposal."
                }
                getSpec={async () => {
                  if (paused && (await read(vault("depositsPaused"))) !== true)
                    throw new InputError(
                      "Pause deposits before executing Retire or Resync.",
                    );
                  return vault("execute", [p.id]);
                }}
              />
              <TxButton
                snapshot={s}
                wallet={w}
                role={kind === 7 ? "owner" : "operator"}
                label="Cancel proposal"
                scope={`Cancel proposal ${p.id}`}
                getSpec={() => vault("cancel", [p.id])}
              />
            </article>
          );
        })}
      </div>
      {Object.keys(w.progress)
        .filter((k) => /^(Execute|Cancel) proposal /.test(k))
        .map((k) => (
          <ActionStatus key={k} wallet={w} scope={k} />
        ))}
      <div className="button-row">
        <button
          disabled={loading || start === 1n}
          onClick={() => setStart((x) => x - 50n)}
        >
          Previous proposal page
        </button>
        <button
          disabled={
            loading ||
            s.globals.proposalCount === undefined ||
            start + 50n > s.globals.proposalCount
          }
          onClick={() => setStart((x) => x + 50n)}
        >
          Next proposal page
        </button>
      </div>
      <p className="disabled-reason">
        {loading
          ? "Reading..."
          : `Pages show up to 50 proposal IDs. ${start === 1n ? "This is the first page." : ""} ${s.globals.proposalCount === undefined ? "Proposal count unreadable. Retry vault." : start + 50n > s.globals.proposalCount ? "This is the last page." : ""}`}
      </p>
    </section>
  );
}
const listingStores = [() => sessionStorage, () => localStorage];
const PASTE_FIRST =
  "Paste the listing rows first so the page can check none is missing.";
// A pasted row whose stock is listed with another feed, pool, quote feed or
// minLiquidity (Check pairings names the field).
function listedDiffers(
  assets: Asset[],
  r: ReturnType<typeof parseLaunch>[number],
) {
  const a = assets.find((x) => same(x.token, r.token));
  return (
    !!a &&
    (!same(a.feed, r.feed) ||
      !same(a.pool, r.pool) ||
      !same(a.quoteFeed, r.quoteFeed) ||
      a.minLiquidity !== r.minLiquidity)
  );
}
const differWords = (tickers: string[]) =>
  `Listed with other values than the pasted lines: ${tickers.join(", ")}. Check pairings shows which field; paste the lines that were listed.`;
export function OwnerPage(props: Props) {
  const { snapshot: s, wallet: w } = props;
  const stock = (stocks = s.assets): Field => ({
    key: "token",
    label: "Stock Token",
    type: "stock",
    stocks,
  });
  const pool: Field[] = [
    { key: "pool", label: "Pool address (zero for no pool)" },
    { key: "quoteFeed", label: "Quote feed address (zero for no pool)" },
    {
      key: "minLiquidity",
      label: "Minimum raw pool liquidity",
      type: "amount",
    },
  ];
  const feedField: Field = { key: "feed", label: "Stock USD feed address" };
  const failing = s.assets.filter((a) => a.reason !== 0);
  const finalized = s.globals.genesisFinalized;
  // The pasted rows are kept in this tab (sessionStorage) and for new tabs
  // (localStorage); this tab's own copy wins.
  const [listing, setListingState] = useState(() => {
    for (const store of listingStores)
      try {
        const saved = store().getItem("basket-listing");
        if (saved) return saved;
      } catch {
        /* storage optional */
      }
    return "";
  });
  const setListing = (value: string) => {
    setListingState(value);
    for (const store of listingStores)
      try {
        store().setItem("basket-listing", value);
      } catch {
        /* storage optional */
      }
  };
  let unlisted: string[] = [],
    differing: string[] = [],
    listingError = "";
  if (listing.trim())
    try {
      const pasted = parseLaunch(listing);
      unlisted = pasted
        .filter((r) => !s.assets.some((a) => same(a.token, r.token)))
        .map((r) => r.ticker);
      differing = pasted
        .filter((r) => listedDiffers(s.assets, r))
        .map((r) => r.ticker);
    } catch (e) {
      listingError = explain(e);
    }
  const jump = (id: string) => {
    const el = document.getElementById(`owner-${id}`);
    el?.scrollIntoView();
    el?.focus({ preventScroll: true });
  };
  return (
    <>
      <PageTitle eyebrow="Behind the counter" title="Owner">
        All controls and proposals are visible to everyone. Only the wallet
        allowed by the vault can send each transaction.
      </PageTitle>
      <div className="jump-links" aria-label="Owner sections">
        {["Launch", "Pause", "Pending", "Immediate", "Propose"].map((label) => (
          <button key={label} onClick={() => jump(label.toLowerCase())}>
            {label}
          </button>
        ))}
      </div>
      <div className="roles panel">
        <div>
          <strong>Owner</strong>
          {s.loading ? "Reading..." : <Addr value={s.globals.owner} />}
        </div>
        <div>
          <strong>Guardian</strong>
          {s.loading ? "Reading..." : <Addr value={s.globals.guardian} />}
        </div>
        <div>
          <strong>Pending owner</strong>
          {s.loading ? (
            "Reading..."
          ) : same(s.globals.pendingOwner, zeroAddress) ? (
            <span>None</span>
          ) : (
            <Addr value={s.globals.pendingOwner} />
          )}
        </div>
      </div>
      {finalized ? (
        <p className="panel" id="owner-launch" tabIndex={-1}>
          Launch done · Genesis finalized.
        </p>
      ) : (
        <section
          className="owner-section panel"
          id="owner-launch"
          tabIndex={-1}
        >
          <h2>Launch</h2>
          <p>
            {s.loading
              ? "Reading..."
              : finalized === undefined
                ? "Genesis unreadable — Retry vault"
                : finalized
                  ? "Genesis finalized"
                  : "Genesis not finalized"}
          </p>
          <div className="two-col">
            <LaunchListing {...props} input={listing} setInput={setListing} />
            <div>
              <ActionForm
                {...props}
                title="Finalize genesis"
                folded={false}
                disabledReason={
                  !listing.trim()
                    ? PASTE_FIRST
                    : listingError ||
                      (unlisted.length
                        ? `Unlisted rows: ${unlisted.join(", ")}. List them first.`
                        : differing.length
                          ? differWords(differing)
                          : "At least three readable stocks must pass every check. Correct failed stocks and retry vault.")
                }
                label="Finalize genesis"
                description="At least three listed stocks must each have reason OK in allAssets()."
                disabled={
                  finalized !== false ||
                  !listing.trim() ||
                  !!listingError ||
                  !!unlisted.length ||
                  !!differing.length ||
                  !s.aggregate ||
                  !s.complete ||
                  s.assets.length < 3 ||
                  !!failing.length
                }
                confirmation="I understand this is irreversible, deposits can start at once, and later stocks can only be added by a List proposal."
                build={async () => {
                  if (!listing.trim()) throw new InputError(PASTE_FIRST);
                  await w.listingPending();
                  const fresh = await loadSnapshot();
                  const pasted = parseLaunch(listing);
                  const missing = pasted.filter(
                    (r) => !fresh.assets.some((a) => same(a.token, r.token)),
                  );
                  if (missing.length)
                    throw new InputError(
                      `Unlisted rows: ${missing.map((r) => r.ticker).join(", ")}. List them first.`,
                    );
                  const changed = pasted.filter((r) =>
                    listedDiffers(fresh.assets, r),
                  );
                  if (changed.length)
                    throw new InputError(
                      differWords(changed.map((r) => r.ticker)),
                    );
                  if (
                    !fresh.aggregate ||
                    !fresh.complete ||
                    fresh.assets.length < 3 ||
                    fresh.assets.some((a) => a.reason !== 0)
                  )
                    throw new InputError(
                      "Finalization blocked: " +
                        (fresh.assets
                          .filter((a) => a.reason !== 0)
                          .map(
                            (a) =>
                              `${a.symbol}: ${reasonWords(a.reason, fresh.globals.settings)}`,
                          )
                          .join("; ") ||
                          "At least three readable stocks required."),
                    );
                  return vault("finalizeGenesis");
                }}
              />
              <p>
                {s.loading
                  ? "Reading..."
                  : !s.complete
                    ? "Listed stocks unreadable · Retry vault"
                    : `${s.assets.length} ${s.assets.length === 1 ? "stock" : "stocks"} listed: ${s.assets.map((a) => a.symbol).join(", ") || "None"}`}
              </p>
              {unlisted.length > 0 && (
                <p className="error">Unlisted rows: {unlisted.join(", ")}</p>
              )}
              {differing.length > 0 && (
                <p className="error">{differWords(differing)}</p>
              )}
              {listingError && <p className="error">{listingError}</p>}
              {failing.map((a) => (
                <p className="error" key={a.token}>
                  {a.symbol}: {reasonWords(a.reason, s.globals.settings)}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="owner-section panel" id="owner-pause" tabIndex={-1}>
        <h2>Deposit pause</h2>
        <p>
          {s.loading
            ? "Reading..."
            : s.globals.depositsPaused === undefined
              ? "Pause state unreadable — Retry vault"
              : s.globals.depositsPaused
                ? "Paused"
                : "Not paused"}
        </p>
        <RoleInfo role="operator" snapshot={s} />
        <TxButton
          {...props}
          label="Pause deposits"
          disabled={s.globals.depositsPaused !== false}
          disabledReason={
            s.globals.depositsPaused
              ? "Deposits are already paused."
              : "Pause state unreadable. Retry vault."
          }
          role="operator"
          getSpec={() => vault("pauseDeposits")}
        />
        <RoleInfo role="owner" snapshot={s} />
        <TxButton
          {...props}
          label="Unpause deposits"
          disabled={s.globals.depositsPaused !== true}
          disabledReason={
            s.globals.depositsPaused === false
              ? "Deposits are already unpaused."
              : "Pause state unreadable. Retry vault."
          }
          role="owner"
          getSpec={() => vault("unpauseDeposits")}
        />
      </section>
      <Proposals {...props} />
      <section
        className="owner-section panel"
        id="owner-immediate"
        tabIndex={-1}
      >
        <h2>Immediate controls</h2>
        <div className="two-col">
          <ActionForm
            {...props}
            title="Close a stock"
            label="Close stock"
            role="operator"
            fields={[stock()]}
            build={(v) => vault("close", [address(v.token)])}
          />

          <ActionForm
            {...props}
            title="Lower size limit"
            label="Lower NAV cap"
            description="Acts at once and voids pending raises. Zero is allowed."
            fields={[
              { key: "cap", label: "Lower limit in dollars", type: "amount" },
            ]}
            build={(v) => vault("lowerNAVCap", [amount(v.cap, true)])}
          />
          <ActionForm
            {...props}
            title="Remove retired stock"
            label="Remove retired"
            role="anyone"
            description="Only when managed and total owed are both zero. Removal changes assetTokens order."
            fields={[stock(s.assets.filter((a) => a.retired))]}
            build={(v) => vault("removeRetired", [address(v.token)])}
          />
          <ActionForm
            {...props}
            title="Transfer ownership"
            label="Start ownership transfer"
            description="The new owner must accept from their own wallet and must not be the guardian."
            fields={[{ key: "next", label: "New owner address" }]}
            build={async (v) => {
              const next = newOwner(v.next);
              if (same(next, await read(vault("guardian"))))
                throw new InputError("The new owner must not be the guardian.");
              return vault("transferOwnership", [next]);
            }}
          />
          <ActionForm
            {...props}
            title="Accept ownership"
            label="Accept ownership"
            role="pending"
            build={async () => {
              if (same(w.account, await read(vault("guardian"))))
                throw new InputError("The new owner must not be the guardian.");
              return vault("acceptOwnership");
            }}
          />
        </div>
      </section>
      <section className="owner-section panel" id="owner-propose" tabIndex={-1}>
        <h2>Propose a change</h2>
        <p>
          Changes wait two days. Only the owner can execute within the following
          seven days. The guardian can cancel, except its own replacement.
        </p>
        <div className="two-col">
          <ActionForm
            {...props}
            title="List"
            label="Propose List"
            fields={[
              { key: "token", label: "New Stock Token address" },
              feedField,
              ...pool,
            ]}
            build={(v) => proposalSpec(0, v)}
          />
          <ActionForm
            {...props}
            title="Feed"
            label="Propose Feed"
            fields={[stock(), feedField]}
            build={(v) => proposalSpec(1, v)}
          />
          <ActionForm
            {...props}
            title="Recentre"
            label="Propose Recentre"
            description="Re-centres the band on the feed answer at execution."
            fields={[stock()]}
            build={(v) => proposalSpec(2, v)}
          />
          <ActionForm
            {...props}
            title="Reopen"
            label="Propose Reopen"
            fields={[stock(s.assets.filter((a) => !a.open && !a.retired))]}
            build={(v) => proposalSpec(3, v)}
          />
          <ActionForm
            {...props}
            title="Retire"
            label="Propose Retire"
            description="Pause deposits before execution."
            fields={[stock(s.assets.filter((a) => !a.open && !a.retired))]}
            confirmation="I understand retirement is permanent: zero in deposit NAV, still paid out on redemption. New depositors take a share of its value from current holders."
            build={(v) => proposalSpec(4, v)}
          />
          <ActionForm
            {...props}
            title="Pool"
            label="Propose Pool"
            fields={[stock(), ...pool]}
            build={(v) => proposalSpec(5, v)}
          />
          <ActionForm
            {...props}
            title="Resync"
            label="Propose Resync"
            description="Pause deposits before proposing; unpause after it executes."
            fields={[stock()]}
            build={async (v) => {
              if ((await read(vault("depositsPaused"))) !== true)
                throw new InputError("Pause deposits before proposing Resync.");
              return proposalSpec(6, v);
            }}
          />
          <ActionForm
            {...props}
            title="Guardian"
            label="Propose Guardian"
            fields={[{ key: "next", label: "New guardian address" }]}
            build={(v) => proposalSpec(7, v)}
          />
          <ActionForm
            {...props}
            title="RaiseCap"
            label="Propose RaiseCap"
            description={`Current size limit: ${usd(s.globals.NAV_CAP)}. Maximum $10 billion.`}
            fields={[
              {
                key: "cap",
                label: "New size limit in dollars",
                type: "amount",
              },
            ]}
            build={(v) => proposalSpec(8, v)}
          />
          <ActionForm
            {...props}
            title="FeeRecipient"
            label="Propose FeeRecipient"
            description="Never unset. Fees start once executed. Later recipient changes use the same waiting period."
            fields={[{ key: "recipient", label: "Fee recipient address" }]}
            confirmation="I understand fees begin once a recipient is set and the recipient can never be unset."
            build={(v) => proposalSpec(9, v)}
          />
          <SettingForm {...props} />
        </div>
      </section>
    </>
  );
}
