import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Address } from "viem";
import {
  read,
  vault,
  simulate,
  explain,
  InputError,
  zeroAddress,
  reasons,
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
} from "./components";
import {
  inspectListing,
  proposalSpec,
  proposalWords,
  proposalKinds,
  settingNames,
  settingFields,
  settingBounds,
  type Pairing,
} from "./governance";
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
function PairingRows({ rows }: { rows: Pairing[] }) {
  return (
    <div className="pairing-grid">
      {rows.map((r, i) => (
        <article className="receipt" key={r.token}>
          <h3>
            Row {i + 1}: <bdi>{r.symbol}</bdi>
          </h3>
          <AddressLink value={r.token} />
          <p>
            Stock feed: <bdi>{r.description}</bdi>
          </p>
          <AddressLink value={r.feed} />
          {r.marked && (
            <strong className="pairing-warning">check this pairing</strong>
          )}
          <p>Feed price: ${fmt(r.price, r.feedDecimals)}</p>
          <p>
            Pool tokens: <bdi>{r.poolSymbols}</bdi>
          </p>
          <p>
            Quote feed: <bdi>{r.quoteName}</bdi>
          </p>
          <p>{r.listed ? "Already listed; will skip" : "Ready to list"}</p>
          {r.error && <p className="error">{r.error}</p>}
        </article>
      ))}
    </div>
  );
}
function LaunchListing({ snapshot: s, wallet: w }: Props) {
  const [input, setInput] = useState(""),
    [rows, setRows] = useState<Pairing[]>([]),
    [checked, setChecked] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [working, setWorking] = useState(false);
  const lock = useRef(false);
  async function check() {
    setWorking(true);
    setRows([]);
    setChecked("");
    setError("");
    try {
      const parsed = parseLaunch(input),
        rs: Pairing[] = [];
      const current = await loadSnapshot();
      if (!current.complete)
        throw new InputError(
          "Listed stocks unreadable. Retry the vault before checking.",
        );
      for (let i = 0; i < parsed.length; i++) {
        let r: Pairing;
        try {
          r = await inspectListing(parsed[i]);
          if (
            !r.listed &&
            current.assets.some((a) => !a.retired && same(a.feed, r.feed))
          )
            r.error = "Stock feed already used by an unretired stock.";
          if (!r.listed && !r.error)
            await simulate(
              vault("genesisList", [
                r.token,
                r.feed,
                r.pool,
                r.quoteFeed,
                r.minLiquidity,
              ]),
              s.globals.owner,
            );
        } catch (e) {
          throw new InputError(`Row ${i + 1}: ${explain(e)}`);
        }
        rs.push(r);
      }
      setRows(rs);
      setChecked(input);
    } catch (e) {
      setError(explain(e));
    } finally {
      setWorking(false);
    }
  }
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
          }}
          spellCheck={false}
        />
      </label>
      <button
        onClick={check}
        disabled={working || s.globals.genesisFinalized !== false}
      >
        Check pairings / Retry
      </button>
      <PairingRows rows={rows} />
      <RoleInfo role="owner" snapshot={s} />
      <button
        disabled={
          working ||
          w.busy ||
          !permitted("owner", w, s) ||
          s.globals.genesisFinalized !== false ||
          checked !== input ||
          !rows.length ||
          rows.some((r) => r.marked || r.error)
        }
        onClick={async () => {
          if (lock.current) return;
          lock.current = true;
          setWorking(true);
          setError("");
          try {
            for (let i = 0; i < rows.length; i++) {
              const r = rows[i];
              setProgress(`row ${i + 1} of ${rows.length}`);
              const before = await read(vault("asset", [r.token]));
              if (!same(before.token, zeroAddress)) continue;
              const fresh = await inspectListing(r);
              if (fresh.marked)
                throw new InputError(`Row ${i + 1}: check this pairing`);
              await w.send(
                vault("genesisList", [
                  r.token,
                  r.feed,
                  r.pool,
                  r.quoteFeed,
                  r.minLiquidity,
                ]),
              );
              const after = await read(vault("asset", [r.token]));
              if (same(after.token, zeroAddress))
                throw new InputError(
                  "Listing confirmation unreadable. Retry pairings before continuing.",
                );
              setRows((old) =>
                old.map((x) =>
                  same(x.token, r.token) ? { ...x, listed: true } : x,
                ),
              );
            }
            setProgress("All rows listed or already present.");
          } catch (e) {
            setError(explain(e));
            setChecked("");
          } finally {
            setWorking(false);
            lock.current = false;
          }
        }}
      >
        List stocks
      </button>
      <p role="status">{progress}</p>
      <p role="alert" className="error">
        {error}
      </p>
    </section>
  );
}
function SettingForm(props: Props) {
  const [key, setKey] = useState(0);
  const current = props.snapshot.globals.settings;
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
        {current
          ? key === 5
            ? `${current.hoursFrom} / ${current.hoursTo} seconds UTC`
            : String(current[settingFields[key]])
          : "unreadable — Retry vault"}
      </p>
      <p>Bounds: {settingBounds[key]}</p>
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
                  label: "From UTC (HH:MM:SS; 00:00:00 for all hours)",
                },
                { key: "to", label: "To UTC (HH:MM:SS; 24:00:00 allowed)" },
              ]
            : [
                {
                  key: "value",
                  label: `New ${settingFields[key]} value`,
                  type: "amount",
                },
              ]
        }
        build={(v) => proposalSpec(10, { ...v, setting: String(key) })}
      />
    </div>
  );
}
function Proposals({ snapshot: s, wallet: w }: Props) {
  const [start, setStart] = useState(1n),
    [rows, setRows] = useState<any[]>([]),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setRows([]);
    setError("");
    read(vault("pendingProposals", [start, 50n]))
      .then(([ids, items]) => {
        if (live)
          setRows(items.map((p: any, i: number) => ({ ...p, id: ids[i] })));
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
    <section className="owner-section panel">
      <div className="section-heading">
        <h2>Pending proposals</h2>
        <button onClick={() => setRetry((x) => x + 1)} disabled={loading}>
          Retry proposals
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
          const ready = BigInt(Math.floor(Date.now() / 1000)) >= p.readyAt,
            expired =
              BigInt(Math.floor(Date.now() / 1000)) > p.readyAt + 7n * 86400n,
            paused = [4, 6].includes(Number(p.action));
          return (
            <article className="receipt" key={String(p.id)}>
              <h3>
                {proposalKinds[p.action as number]} · Proposal {String(p.id)}
              </h3>
              <p>
                Stock:{" "}
                {same(p.token, zeroAddress)
                  ? "Global setting"
                  : (s.assets.find((a) => same(a.token, p.token))?.symbol ??
                    "unlisted / symbol unreadable")}
              </p>
              {!same(p.token, zeroAddress) && <Addr value={p.token} />}
              <p className="chain-text">
                {proposalWords(Number(p.action), p.data)}
              </p>
              <p>
                {ready
                  ? `ready until ${date(p.readyAt + 7n * 86400n)}`
                  : `waiting, executable from ${date(p.readyAt)}`}
              </p>
              {paused && (
                <Note warning>Keep deposits paused for execution.</Note>
              )}
              <TxButton
                snapshot={s}
                wallet={w}
                role="owner"
                label="Execute"
                disabled={
                  !ready ||
                  expired ||
                  (paused && s.globals.depositsPaused !== true)
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
                role={Number(p.action) === 7 ? "owner" : "operator"}
                label="Cancel proposal"
                getSpec={() => vault("cancel", [p.id])}
              />
            </article>
          );
        })}
      </div>
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
    </section>
  );
}
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
  return (
    <>
      <PageTitle eyebrow="Behind the counter" title="Owner">
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
          {same(s.globals.pendingOwner, zeroAddress) ? (
            <span>None</span>
          ) : (
            <Addr value={s.globals.pendingOwner} />
          )}
        </div>
      </div>
      <section className="owner-section panel">
        <h2>Launch</h2>
        <p>
          {finalized === undefined
            ? "Genesis unreadable — Retry vault"
            : finalized
              ? "Genesis finalized"
              : "Genesis not finalized"}
        </p>
        <div className="two-col">
          <LaunchListing {...props} />
          <div>
            <ActionForm
              {...props}
              title="Finalize genesis"
              label="Finalize genesis"
              description="At least three listed stocks must each have reason OK in allAssets()."
              disabled={
                finalized !== false ||
                !s.aggregate ||
                !s.complete ||
                s.assets.length < 3 ||
                !!failing.length
              }
              confirmation="I understand this is irreversible, deposits can start at once, and later stocks can only be added by a List proposal."
              build={async () => {
                const fresh = await loadSnapshot();
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
                            `${a.symbol}: ${a.reason === undefined ? "unreadable" : reasons[a.reason]}`,
                        )
                        .join("; ") ||
                        "At least three readable stocks required."),
                  );
                return vault("finalizeGenesis");
              }}
            />
            {failing.map((a) => (
              <p className="error" key={a.token}>
                {a.symbol}:{" "}
                {a.reason === undefined ? "unreadable" : reasons[a.reason]}
              </p>
            ))}
          </div>
        </div>
      </section>
      <section className="owner-section panel">
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
            title="Centre"
            label="Propose Centre"
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
            title="NavCap"
            label="Propose NavCap"
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
      <Proposals {...props} />
      <section className="owner-section panel">
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
          <section className="panel">
            <h3>Deposit pause</h3>
            <p>
              {s.globals.depositsPaused === undefined
                ? "Pause state unreadable — Retry vault"
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
            title="Lower size limit"
            label="Lower NAV cap"
            description="Acts at once and voids pending raises. Zero is allowed."
            fields={[
              { key: "cap", label: "Lower limit in dollars", type: "amount" },
            ]}
            build={(v) => vault("lowerNavCap", [amount(v.cap, true)])}
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
              const next = address(v.next);
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
    </>
  );
}
